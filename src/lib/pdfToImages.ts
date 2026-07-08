// Renderiza páginas de um PDF como PNG base64 (sem prefixo data:).
// Usa pdfjs-dist com worker servido pela CDN.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite resolve worker como URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

export async function pdfToPngBase64(
  file: File,
  opts: { maxPages?: number; scale?: number } = {}
): Promise<string[]> {
  const maxPages = opts.maxPages ?? 5;
  const scale = opts.scale ?? 2;
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const out: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    out.push(dataUrl.split(",")[1] || "");
  }
  return out;
}
