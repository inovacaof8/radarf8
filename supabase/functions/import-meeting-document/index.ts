// Edge Function: Importa um arquivo DOCX/PDF de ata, extrai o texto bruto e
// devolve uma transcrição limpa para ser usada pelo gerador de ata.
// Recebe (JSON): { file_name, mime_type, file_b64 }
// Retorna: { extracted_text, char_count }

import mammoth from "npm:mammoth@1.8.0";
import { getDocument } from "npm:pdfjs-dist@4.7.76/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return (value || "").trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const loadingTask = getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = (content.items as Array<{ str?: string }>).map((it) => it.str ?? "");
    parts.push(strings.join(" "));
  }
  return parts.join("\n\n").trim();
}

function detectKind(name: string, mime: string): "docx" | "pdf" | null {
  const lname = (name || "").toLowerCase();
  const lmime = (mime || "").toLowerCase();
  if (lmime.includes("pdf") || lname.endsWith(".pdf")) return "pdf";
  if (
    lmime.includes("officedocument.wordprocessingml") ||
    lmime.includes("msword") ||
    lname.endsWith(".docx") ||
    lname.endsWith(".doc")
  ) return "docx";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "JSON inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_name, mime_type, file_b64 } = body as {
      file_name?: string;
      mime_type?: string;
      file_b64?: string;
    };

    if (!file_b64 || typeof file_b64 !== "string") {
      return new Response(JSON.stringify({ error: "Arquivo ausente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kind = detectKind(file_name ?? "", mime_type ?? "");
    if (!kind) {
      return new Response(
        JSON.stringify({ error: "Formato não suportado. Envie DOCX ou PDF." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bytes = b64ToBytes(file_b64);
    if (bytes.length > MAX_BYTES) {
      return new Response(
        JSON.stringify({ error: "Arquivo maior que 15MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let text = "";
    if (kind === "docx") {
      text = await extractDocx(bytes);
    } else {
      text = await extractPdf(bytes);
    }

    // Normaliza espaços em excesso mantendo quebras de linha
    text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (text.length < 20) {
      return new Response(
        JSON.stringify({
          error:
            "Não foi possível extrair texto suficiente do arquivo. Se for PDF escaneado, faça OCR antes de enviar.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ extracted_text: text, char_count: text.length, kind }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("import-meeting-document error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
