// Edge Function: Gera ata estruturada de reunião usando Lovable AI (tool calling)
// Recebe: { meeting_id, raw_input, mode, meeting_context }
// Retorna: { formatted_content (markdown), action_items: [{title, description, assignee_email_hint, due_date, priority}] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente PMO especialista em redigir atas de reunião profissionais em português do Brasil.

Receberá notas brutas, transcrição ou bullets de uma reunião. Sua tarefa:
1. Produzir uma ATA FORMAL em Markdown contendo: Cabeçalho, Pauta, Discussões, Decisões, Próximos Passos, Encerramento.
2. Extrair TODAS as atividades/pendências (action items) com: título objetivo, descrição, responsável (pelo nome ou e-mail mencionado), prazo (se mencionado, no formato YYYY-MM-DD), prioridade (baixa/media/alta).

Regras de datas:
- Use a data da reunião ou a data de referência informada no prompt para inferir o ano quando o documento trouxer apenas dia/mês (ex.: 07/05).
- Nunca use anos passados por padrão. Só retorne um ano anterior se ele estiver explicitamente escrito no documento.
- Se o prazo aparecer como dia/mês sem ano e ainda vai ocorrer neste ano, use o ano atual/de referência.

Use SEMPRE a função structure_meeting_minutes para retornar o resultado. Não responda em texto livre.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const body = await req.json();
    const { raw_input, mode, meeting_context } = body;

    if (!raw_input || typeof raw_input !== "string" || raw_input.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Conteúdo bruto muito curto para gerar ata." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const referenceDate = new Date().toISOString().slice(0, 10);

    const userPrompt = `DATA DE REFERÊNCIA PARA PRAZOS: ${referenceDate}

CONTEXTO DA REUNIÃO:
${JSON.stringify(meeting_context ?? {}, null, 2)}

MODO DE ENTRADA: ${mode}

CONTEÚDO BRUTO:
${raw_input}

Gere a ata e extraia as atividades.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "structure_meeting_minutes",
              description: "Retorna a ata formatada e a lista estruturada de atividades.",
              parameters: {
                type: "object",
                properties: {
                  formatted_content: {
                    type: "string",
                    description: "Ata completa em Markdown, em português do Brasil.",
                  },
                  action_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        assignee_email_hint: {
                          type: "string",
                          description: "Nome ou e-mail do responsável conforme mencionado. Vazio se não houver.",
                        },
                        due_date: {
                          type: "string",
                          description: "Data no formato YYYY-MM-DD ou string vazia se não houver.",
                        },
                        priority: { type: "string", enum: ["baixa", "media", "alta"] },
                      },
                      required: ["title", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["formatted_content", "action_items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "structure_meeting_minutes" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na sua workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro no gateway de IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Sem tool_call na resposta", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "IA não retornou estrutura esperada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(
      JSON.stringify({ ...parsed, model: "google/gemini-3-flash-preview" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-meeting-minutes error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
