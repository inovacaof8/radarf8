// GED AI Search — interprets a natural language query and returns documents
// the user is allowed to see (RLS enforced by using the user JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  type: "function",
  function: {
    name: "extract_filters",
    description: "Extract GED search filters from a Portuguese natural language query.",
    parameters: {
      type: "object",
      properties: {
        tipo_documento: {
          type: "string",
          enum: ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"],
        },
        origem_documento: { type: "string", enum: ["Parceiro", "Própria instituição"] },
        status: { type: "string", enum: ["Vigente", "Vencido", "Substituído", "Inativo"] },
        parceiro_nome: { type: "string" },
        produto_nome: { type: "string" },
        instituicao_nome: { type: "string" },
        orgao_emissor: { type: "string" },
        validade_ano: { type: "integer" },
        keywords: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return json({ error: "Query inválida." }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "IA indisponível." }, 500);

    // 1) Extract filters from the query
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você ajuda a transformar perguntas em português sobre documentos técnicos em filtros estruturados. Extraia somente filtros explícitos. Use keywords para termos livres.",
          },
          { role: "user", content: query },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_filters" } },
      }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limit. Tente novamente." }, 429);
    if (aiRes.status === 402) return json({ error: "Créditos esgotados." }, 402);
    if (!aiRes.ok) return json({ error: "Falha na IA." }, 500);

    const aiData = await aiRes.json();
    const call = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const filters = call ? JSON.parse(call.function.arguments || "{}") : {};

    // 2) Build query against ged_document (RLS enforced)
    let q = (supabase as any)
      .from("ged_document")
      .select(
        "id, titulo, tipo_documento, origem_documento, status, data_validade, orgao_emissor, descricao, tags, observacoes, parceiro:ged_partner(id,name), produto:ged_product(id,name), instituicao:ged_institution(id,name)",
      )
      .limit(50);

    if (filters.tipo_documento) q = q.eq("tipo_documento", filters.tipo_documento);
    if (filters.origem_documento) q = q.eq("origem_documento", filters.origem_documento);
    if (filters.status) q = q.eq("status", filters.status);

    // Resolve partner/product/institution by name
    const resolveId = async (table: string, name?: string) => {
      if (!name) return null;
      const { data } = await (supabase as any)
        .from(table)
        .select("id")
        .ilike("name", `%${name}%`)
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    };

    const [pid, prodid, instid] = await Promise.all([
      resolveId("ged_partner", filters.parceiro_nome),
      resolveId("ged_product", filters.produto_nome),
      resolveId("ged_institution", filters.instituicao_nome),
    ]);

    if (pid) q = q.eq("parceiro_id", pid);
    if (prodid) q = q.eq("produto_id", prodid);
    if (instid) q = q.eq("instituicao_id", instid);
    if (filters.orgao_emissor) q = q.ilike("orgao_emissor", `%${filters.orgao_emissor}%`);

    if (filters.validade_ano) {
      q = q
        .gte("data_validade", `${filters.validade_ano}-01-01`)
        .lte("data_validade", `${filters.validade_ano}-12-31`);
    }

    const { data: docs, error } = await q;
    if (error) {
      console.error("query error", error);
      return json({ error: "Erro na busca." }, 500);
    }

    // 3) Filter by keywords (titulo/descricao/tags/observacoes)
    let results = docs ?? [];
    const kws: string[] = filters.keywords ?? [];
    if (kws.length) {
      results = results.filter((d: any) => {
        const hay = [
          d.titulo,
          d.descricao,
          d.observacoes,
          d.orgao_emissor,
          ...(d.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return kws.every((k) => hay.includes(String(k).toLowerCase()));
      });
    }

    // 4) Build motivo_resultado for each
    const items = results.map((d: any) => {
      const reasons: string[] = [];
      if (filters.tipo_documento) reasons.push(`tipo ${filters.tipo_documento}`);
      if (filters.status) reasons.push(`status ${filters.status}`);
      if (filters.origem_documento) reasons.push(`origem ${filters.origem_documento}`);
      if (d.parceiro?.name && filters.parceiro_nome) reasons.push(`parceiro ${d.parceiro.name}`);
      if (d.produto?.name && filters.produto_nome) reasons.push(`produto ${d.produto.name}`);
      if (d.instituicao?.name && filters.instituicao_nome)
        reasons.push(`instituição ${d.instituicao.name}`);
      if (filters.orgao_emissor) reasons.push(`órgão ${filters.orgao_emissor}`);
      if (kws.length) reasons.push(`palavras: ${kws.join(", ")}`);
      const motivo = reasons.length
        ? `Encontrado por correspondência de ${reasons.join("; ")}.`
        : "Resultado aproximado para sua busca.";
      return { ...d, motivo_resultado: motivo };
    });

    return json({ filters, results: items });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
