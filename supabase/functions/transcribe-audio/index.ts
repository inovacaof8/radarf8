// Transcribe audio with Lovable AI dedicated STT endpoint (openai/gpt-4o-mini-transcribe).
// Receives base64 audio + mime_type, returns transcribed Portuguese text.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map browser mime types to file extensions OpenAI infers the container from.
function extFor(mt: string): { ext: string; type: string } {
  const m = (mt || "").toLowerCase().split(";")[0];
  if (m.includes("webm")) return { ext: "webm", type: "audio/webm" };
  if (m.includes("ogg")) return { ext: "ogg", type: "audio/ogg" };
  if (m.includes("mp3") || m.includes("mpeg")) return { ext: "mp3", type: "audio/mpeg" };
  if (m.includes("wav")) return { ext: "wav", type: "audio/wav" };
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac"))
    return { ext: "mp4", type: "audio/mp4" };
  if (m.includes("flac")) return { ext: "flac", type: "audio/flac" };
  return { ext: "webm", type: "audio/webm" };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const { audio_base64, mime_type, context } = await req.json();
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return new Response(JSON.stringify({ error: "audio_base64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const approxBytes = Math.floor((audio_base64.length * 3) / 4);
    const { ext, type } = extFor(mime_type ?? "audio/webm");
    console.log("transcribe-audio: received", { mime_type, ext, approxBytes });

    if (approxBytes < 10 * 1024) {
      return new Response(
        JSON.stringify({
          error:
            "Áudio não recebido ou muito curto. Grave novamente e aguarde alguns segundos antes de parar.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (approxBytes > 24 * 1024 * 1024) {
      return new Response(
        JSON.stringify({
          error: "Áudio muito longo (>24MB). Grave em blocos menores (até ~10 minutos).",
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build multipart upload for the dedicated transcription endpoint
    const bytes = base64ToBytes(audio_base64);
    const blob = new Blob([bytes], { type });
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", blob, `recording.${ext}`);
    form.append("language", "pt");
    if (context && typeof context === "string" && context.trim()) {
      // OpenAI "prompt" ajuda a reconhecer nomes/jargões; não vai no texto final.
      form.append("prompt", context.trim().slice(0, 800));
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });

    if (!response.ok) {
      const t = await response.text().catch(() => "");
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos do Lovable AI esgotados. Adicione saldo em Settings → Workspace.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Erro na transcrição: ${response.status} ${t.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const text: string = (data?.text ?? "").trim();
    console.log("transcribe-audio: ok", { textLength: text.length, usage: data?.usage });

    if (!text) {
      return new Response(
        JSON.stringify({
          error:
            "Não foi possível identificar fala no áudio. Verifique o microfone e tente novamente.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ text, finishReason: "stop" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
