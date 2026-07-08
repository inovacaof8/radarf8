import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Body = {
  file_base64?: string;
  mime_type?: string;
  filename: string;
  images?: { base64: string; mime_type: string }[];
  partners?: string[];
  products?: string[];
  institutions?: string[];
};

const TYPES = ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"];
const ORIGINS = ["Parceiro", "Própria instituição"];

const tool = {
  type: "function",
  function: {
    name: "extract_document_metadata",
    description: "Extrai metadados de um documento técnico (certidão, atestado, laudo, etc.).",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título objetivo do documento" },
        tipo_documento: { type: "string", enum: TYPES },
        origem_documento: { type: "string", enum: ORIGINS },
        parceiro_nome: { type: "string", description: "Empresa que PRESTOU o serviço / fornecedor / contratada / emissora do atestado. Vazio se não aplicável." },
        instituicao_nome: { type: "string", description: "Empresa que RECEBEU o serviço / contratante / tomadora / cliente / destinatária do documento." },
        produto_nome: { type: "string", description: "Nome do produto referenciado. Vazio se não aplicável." },
        numero_documento: { type: "string" },
        orgao_emissor: { type: "string", description: "Órgão/entidade emissor do documento (cartório, INMETRO, etc.)" },
        data_emissao: { type: "string", description: "ISO yyyy-mm-dd" },
        data_validade: { type: "string", description: "ISO yyyy-mm-dd" },
        descricao: { type: "string", description: "Resumo curto (2-3 linhas)" },
        tags: { type: "array", items: { type: "string" } },
        confianca: { type: "number", description: "0 a 1" },
      },
      required: ["titulo", "tipo_documento", "origem_documento"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    const hasImages = Array.isArray(body.images) && body.images.length > 0;
    if (!hasImages && (!body.file_base64 || !body.mime_type)) {
      return new Response(JSON.stringify({ error: "file_base64+mime_type or images[] are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `Você extrai metadados de documentos técnicos brasileiros (certidões, atestados, laudos, INMETRO, etc.).
Use APENAS as informações visíveis no documento. Se um campo não estiver claro, deixe vazio.

REGRA CRÍTICA sobre as duas empresas:
- "parceiro_nome" = empresa que PRESTOU o serviço / forneceu / executou / é a CONTRATADA. Em atestados de capacidade técnica é quem RECEBE o atestado (a fornecedora).
- "instituicao_nome" = empresa que RECEBEU o serviço / é a CONTRATANTE / cliente / TOMADORA. Em atestados é quem EMITE o atestado declarando ter contratado.
Nunca confunda os dois. Se houver apenas uma empresa identificável, preencha apenas o campo correspondente.

Para parceiro/produto/instituição, prefira reaproveitar nomes existentes da lista quando houver correspondência clara (mesmo que com variação de grafia).
Datas SEMPRE no formato ISO yyyy-mm-dd.`;

    const ctx = `Listas existentes para reaproveitar:
Parceiros: ${(body.partners ?? []).join(" | ") || "(vazio)"}
Produtos: ${(body.products ?? []).join(" | ") || "(vazio)"}
Instituições: ${(body.institutions ?? []).join(" | ") || "(vazio)"}
Nome do arquivo: ${body.filename}`;

    const userContent: any[] = [{ type: "text", text: ctx }];

    if (hasImages) {
      for (const img of body.images!) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${img.mime_type};base64,${img.base64}` },
        });
      }
    } else {
      const mt = body.mime_type!;
      const isImage = mt.startsWith("image/");
      const isPdf = mt === "application/pdf";
      if (isImage || isPdf) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${mt};base64,${body.file_base64}` },
        });
      } else {
        try {
          const text = atob(body.file_base64!);
          userContent.push({ type: "text", text: `Conteúdo do arquivo:\n${text.slice(0, 60_000)}` });
        } catch {
          userContent.push({ type: "text", text: "(arquivo binário não suportado)" });
        }
      }
    }

    const payload = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "extract_document_metadata" } },
    });

    let resp: Response | null = null;
    let lastErrText = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: payload,
      });
      if (resp.ok || resp.status === 429 || resp.status === 402) break;
      lastErrText = await resp.text().catch(() => "");
      console.error(`AI gateway attempt ${attempt + 1} failed:`, resp.status, lastErrText.slice(0, 200));
      // transient (5xx) - backoff and retry
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!resp) {
      return new Response(JSON.stringify({ error: "Falha ao consultar IA." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => lastErrText);
      console.error("AI gateway error:", resp.status, t);
      const msg = resp.status >= 500
        ? "O serviço de IA está instável no momento (erro upstream). Tente novamente em alguns segundos."
        : "Falha ao consultar IA.";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "IA não retornou metadados." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify({ metadata: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
