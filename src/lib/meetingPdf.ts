import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { drawCover, pageHeader, paginate, C_INK, C_BRAND, C_MUTED, C_LINE } from "@/lib/pdfTheme";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export function exportMeetingPdf({
  meeting,
  minute,
  actions,
  profiles,
  participants,
}: {
  meeting: any;
  minute: any | null;
  actions: any[];
  profiles: any[];
  participants: any[];
}) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const dateStr = meeting.scheduled_at
    ? format(new Date(meeting.scheduled_at), "PPPp", { locale: ptBR })
    : "—";

  // Cover
  drawCover(
    doc,
    "ATA DE REUNIÃO",
    "Registro institucional",
    meeting.title || "Reunião",
    dateStr,
    [
      `Modalidade: ${meeting.modality ?? "—"}`,
      meeting.location ? `Local/Link: ${meeting.location}` : "",
      `Duração: ${meeting.duration_minutes ?? "—"} min`,
      `Status: ${meeting.status ?? "—"}`,
      `Emitido em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    ].filter(Boolean),
  );

  // Page 2 — agenda + participants + minute
  doc.addPage();
  pageHeader(doc, "Ata", meeting.title || "Reunião", dateStr);
  let y = 40;

  if (meeting.agenda) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C_INK);
    doc.text("PAUTA", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(meeting.agenda, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  if (participants?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PARTICIPANTES", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const names = participants
      .map((p) => profiles.find((x) => x.user_id === p.user_id)?.name || p.user_id)
      .join(" • ");
    const lines = doc.splitTextToSize(names, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CONTEÚDO DA ATA", margin, y);
  y += 6;

  const content = (minute?.formatted_content || "Sem ata registrada.").trim();
  const maxW = pageW - margin * 2;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - 18) {
      doc.addPage();
      pageHeader(doc, "Ata (continuação)", meeting.title || "Reunião", dateStr);
      y = 40;
    }
  };

  // Render markdown-aware text with consistent typography (vector text, not image)
  const renderInline = (text: string, x: number, baseSize: number, baseStyle: "normal" | "bold") => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    const segments: { text: string; bold: boolean; italic: boolean }[] = [];
    for (const p of parts) {
      if (p.startsWith("**") && p.endsWith("**")) segments.push({ text: p.slice(2, -2), bold: true, italic: false });
      else if (p.startsWith("*") && p.endsWith("*")) segments.push({ text: p.slice(1, -1), bold: false, italic: true });
      else segments.push({ text: p, bold: false, italic: false });
    }
    doc.setFontSize(baseSize);
    const lineH = baseSize * 0.45 + 1.2;
    const lineRight = margin + maxW;
    let cursorX = x;
    for (const seg of segments) {
      const style = seg.bold || baseStyle === "bold" ? "bold" : seg.italic ? "italic" : "normal";
      doc.setFont("helvetica", style as any);
      const tokens = seg.text.split(/(\s+)/);
      for (const w of tokens) {
        if (!w) continue;
        const wWidth = doc.getTextWidth(w);
        if (cursorX + wWidth > lineRight && w.trim()) {
          y += lineH;
          ensureSpace(lineH);
          cursorX = x;
          if (!w.trim()) continue;
        }
        doc.text(w, cursorX, y);
        cursorX += wWidth;
      }
    }
    y += lineH;
  };

  const rawLines = content.split(/\r?\n/);
  for (const raw of rawLines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { y += 2.5; ensureSpace(4); continue; }
    let m: RegExpMatchArray | null;
    doc.setTextColor(...C_INK);
    if ((m = line.match(/^#{1}\s+(.*)$/))) { ensureSpace(8); y += 2; renderInline(m[1], margin, 13, "bold"); y += 1.5; continue; }
    if ((m = line.match(/^#{2}\s+(.*)$/))) { ensureSpace(7); y += 1.5; renderInline(m[1], margin, 11.5, "bold"); y += 1; continue; }
    if ((m = line.match(/^#{3,}\s+(.*)$/))) { ensureSpace(6); renderInline(m[1], margin, 10.5, "bold"); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      ensureSpace(5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text("•", margin + 1, y);
      renderInline(m[1], margin + 6, 10, "normal");
      continue;
    }
    if ((m = line.match(/^\s*(\d+)\.\s+(.*)$/))) {
      ensureSpace(5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`${m[1]}.`, margin + 1, y);
      renderInline(m[2], margin + 8, 10, "normal");
      continue;
    }
    ensureSpace(5);
    renderInline(line, margin, 10, "normal");
  }

  // Actions page
  doc.addPage();
  pageHeader(doc, "Plano de Ação", meeting.title || "Reunião", dateStr);

  if (!actions?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C_MUTED);
    doc.text("Nenhuma atividade registrada.", margin, 44);
  } else {
    const rows = actions.map((a) => {
      const assignee =
        profiles.find((p) => p.user_id === a.assignee_id)?.name ||
        a.assignee_external_name ||
        a.assignee_email_hint ||
        "—";
      return [
        a.title + (a.description ? `\n${a.description}` : ""),
        assignee,
        a.due_date ? format(new Date(`${a.due_date}T12:00:00`), "dd/MM/yyyy") : "—",
        a.priority ?? "—",
        STATUS_LABEL[a.status] ?? a.status ?? "—",
      ];
    });
    autoTable(doc, {
      startY: 38,
      head: [["Atividade", "Responsável", "Prazo", "Prioridade", "Status"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2.5, textColor: C_INK, lineColor: C_LINE, lineWidth: 0.2 },
      headStyles: { fillColor: C_INK, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 38 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
    });
  }

  paginate(doc, "Ata de Reunião");

  const safeTitle = (meeting.title || "reuniao").replace(/[^\w\-]+/g, "_").slice(0, 60);
  const dateTag = format(new Date(meeting.scheduled_at || Date.now()), "yyyy-MM-dd");
  doc.save(`ata_${safeTitle}_${dateTag}.pdf`);
}
