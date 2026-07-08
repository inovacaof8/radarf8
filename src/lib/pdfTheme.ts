// PDF theme inspired by F-lux export (institutional, vector-based jsPDF)
// Adapted to GovBase corporate blue palette.
import type { jsPDF } from "jspdf";

// F8 palette — preto/amarelo institucional
export const C_INK: [number, number, number] = [10, 10, 10];        // near black
export const C_BRAND: [number, number, number] = [255, 212, 0];     // F8 yellow
export const C_BRAND_SOFT: [number, number, number] = [255, 248, 210];
export const C_MUTED: [number, number, number] = [107, 107, 107];
export const C_LINE: [number, number, number] = [229, 229, 229];
export const C_BG_SOFT: [number, number, number] = [248, 248, 248];

export const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const HEALTH_LABEL: Record<string, string> = {
  verde: "Saudável",
  amarelo: "Atenção",
  vermelho: "Crítico",
};
export const fmtHealth = (h?: string | null) =>
  h ? (HEALTH_LABEL[h] || h.charAt(0).toUpperCase() + h.slice(1)) : "—";

const STATUS_LABEL: Record<string, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  encerramento: "Encerramento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  ativo: "Ativo",
  pausado: "Pausado",
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};
export const fmtStatus = (s?: string | null) =>
  s ? (STATUS_LABEL[s] || String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())) : "—";

export function pageHeader(doc: jsPDF, titulo: string, subtitulo: string, contexto: string) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C_INK);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setFillColor(...C_BRAND);
  doc.rect(0, 18, pageW, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(subtitulo, margin, 11.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(contexto, pageW - margin, 11.5, { align: "right" });

  // Section title under header
  doc.setTextColor(...C_INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(titulo.toUpperCase(), margin, 30);
  doc.setDrawColor(...C_BRAND);
  doc.setLineWidth(1.2);
  doc.line(margin, 32, margin + 22, 32);
  doc.setLineWidth(0.2);
}

export function paginate(doc: jsPDF, brand: string) {
  const total = (doc.internal as unknown as { pages: unknown[] }).pages.length - 1;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C_MUTED);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 8, { align: "right" });
    doc.text(brand, margin, pageH - 8);
  }
}

export function drawCover(
  doc: jsPDF,
  brand: string,
  brandSubtitle: string,
  title: string,
  subtitle: string,
  meta: string[],
) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...C_INK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...C_BRAND);
  doc.rect(0, pageH - 12, pageW, 12, "F");

  doc.setTextColor(...C_BRAND);
  doc.setFont("helvetica", "bold");
  const brandText = brand.toUpperCase();
  const maxBrandW = pageW - margin * 2;
  let brandSize = 56;
  doc.setFontSize(brandSize);
  while (doc.getTextWidth(brandText) > maxBrandW && brandSize > 18) {
    brandSize -= 2;
    doc.setFontSize(brandSize);
  }
  doc.text(brandText, margin, 70);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(brandSubtitle.toUpperCase(), margin, 80);

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), margin, 130, { maxWidth: pageW - margin * 2 });

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C_BRAND);
  doc.text(subtitle, margin, 144, { maxWidth: pageW - margin * 2 });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  let y = 156;
  meta.forEach((m) => {
    doc.text(m, margin, y);
    y += 6;
  });
}

export function drawKpiGrid(
  doc: jsPDF,
  startY: number,
  kpis: [string, string][],
  cols = 3,
) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 6;
  const kw = (pageW - margin * 2 - gap * (cols - 1)) / cols;
  const kh = 26;
  kpis.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (kw + gap);
    const y = startY + row * (kh + gap);
    doc.setDrawColor(...C_LINE);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, kw, kh, 1.5, 1.5, "FD");
    doc.setFillColor(...C_BRAND);
    doc.rect(x, y, kw, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(k[0].toUpperCase(), x + 3, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C_INK);
    doc.text(k[1], x + 3, y + 20, { maxWidth: kw - 6 });
  });
  return startY + Math.ceil(kpis.length / cols) * (kh + gap);
}

export async function captureElementImage(
  selector: string,
  opts: { backgroundColor?: string } = {},
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: opts.backgroundColor || "#ffffff",
    windowWidth: el.scrollWidth,
    useCORS: true,
    logging: false,
  });
  return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
}
