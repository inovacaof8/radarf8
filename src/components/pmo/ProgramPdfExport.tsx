import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  C_INK, C_BRAND, C_BRAND_SOFT, C_MUTED, C_LINE, C_BG_SOFT,
  fmtBRL, fmtNum, fmtDate, fmtHealth, fmtStatus,
  pageHeader, paginate, drawCover, drawKpiGrid,
} from "@/lib/pdfTheme";

interface Props {
  programId: string;
  programName: string;
  portfolioName?: string | null;
}

const HEALTH: Record<string, [number, number, number]> = {
  verde: [34, 197, 94],
  amarelo: [234, 179, 8],
  vermelho: [220, 38, 38],
};
const C_OK: [number, number, number] = [34, 197, 94];
const C_BAD: [number, number, number] = [220, 38, 38];

export default function ProgramPdfExport({ programId, programName, portfolioName }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [{ data: program }, { data: projects }] = await Promise.all([
        supabase
          .from("program")
          .select("id, name, status, benefits, start_date, end_date, portfolio:portfolio_id(name)")
          .eq("id", programId)
          .maybeSingle(),
        supabase
          .from("project")
          .select("id, name, code, status, health, budget_planned, budget_spent, start_date, end_date, baseline_end_date")
          .eq("program_id", programId),
      ]);

      const pf = portfolioName || (program as any)?.portfolio?.name || "Portfolio";
      const projectIds = (projects || []).map((p) => p.id);
      const [{ data: tasks }, { data: risks }] = await Promise.all([
        projectIds.length
          ? supabase.from("task").select("status, end_date, project_id").in("project_id", projectIds)
          : Promise.resolve({ data: [] as any[] }),
        projectIds.length
          ? supabase.from("risk").select("description, exposure, status, project_id")
              .in("project_id", projectIds)
              .order("exposure", { ascending: false, nullsFirst: false }).limit(10)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ps = projects || [];
      const ts = tasks || [];
      const active = ps.filter((p) => p.status === "ativo" || p.status === "execucao").length;
      const concluded = ps.filter((p) => p.status === "concluido" || p.status === "encerramento").length;
      const delayed = ps.filter((p) => p.end_date && p.status !== "concluido" && new Date(p.end_date) < today).length;
      const planned = ps.reduce((s, p) => s + Number(p.budget_planned || 0), 0);
      const spent = ps.reduce((s, p) => s + Number(p.budget_spent || 0), 0);
      const overdueTasks = ts.filter((t) => t.end_date && t.status !== "concluida" && new Date(t.end_date) < today).length;
      const burnPct = planned > 0 ? Math.round((spent / planned) * 100) : 0;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const ctx = `${pf} · ${programName}`;
      const brandFooter = `${pf} · ${programName}`;

      // ── Capa
      drawCover(
        doc,
        pf,
        "Portfolio",
        programName,
        "Relatório Executivo do Programa",
        [
          `Programa: ${programName}`,
          `Período: ${fmtDate(program?.start_date)} → ${fmtDate(program?.end_date)}`,
          `Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
        ],
      );

      // ── Resumo executivo
      doc.addPage();
      pageHeader(doc, "Resumo executivo", pf, ctx);

      const yAfter = drawKpiGrid(doc, 38, [
        ["Projetos no programa", fmtNum(ps.length)],
        ["Ativos", fmtNum(active)],
        ["Concluídos", fmtNum(concluded)],
        ["Atrasados", fmtNum(delayed)],
        ["Tarefas em atraso", fmtNum(overdueTasks)],
        ["Consumo orçamentário", `${burnPct}%`],
      ], 3);

      // Orçamento
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C_INK);
      doc.text("Orçamento do programa", margin, yAfter + 4);
      const yBud = yAfter + 8;
      const bw = (pageW - margin * 2 - 12) / 3;
      ([
        ["Planejado", fmtBRL(planned)],
        ["Gasto", fmtBRL(spent)],
        ["Variação", fmtBRL(spent - planned)],
      ] as [string, string][]).forEach((c, i) => {
        const x = margin + i * (bw + 6);
        doc.setDrawColor(...C_LINE); doc.setFillColor(...C_BG_SOFT);
        doc.roundedRect(x, yBud, bw, 22, 1.5, 1.5, "FD");
        doc.setFillColor(...C_BRAND); doc.rect(x, yBud, bw, 1.2, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C_MUTED);
        doc.text(c[0].toUpperCase(), x + 3, yBud + 7);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...C_INK);
        doc.text(c[1], x + 3, yBud + 17);
      });
      const yBar = yBud + 30;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...C_MUTED);
      doc.text(`Consumo: ${burnPct}% do orçamento planejado`, margin, yBar);
      doc.setFillColor(...C_LINE); doc.roundedRect(margin, yBar + 2, pageW - margin * 2, 4, 1, 1, "F");
      const fillW = Math.min(burnPct, 100) / 100 * (pageW - margin * 2);
      const barColor: [number, number, number] = burnPct > 100 ? C_BAD : C_BRAND;
      doc.setFillColor(...barColor); doc.roundedRect(margin, yBar + 2, fillW, 4, 1, 1, "F");

      // ── Saúde + Fase (gráficos vetoriais)
      doc.addPage();
      pageHeader(doc, "Indicadores", pf, ctx);

      const healthCounts: Record<string, number> = { verde: 0, amarelo: 0, vermelho: 0 };
      ps.forEach((p) => { if (p.health) healthCounts[p.health] = (healthCounts[p.health] || 0) + 1; });
      const statusCounts: Record<string, number> = {};
      ps.forEach((p) => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

      // Saúde (left)
      const colW = (pageW - margin * 2 - 8) / 2;
      let yc = 38;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C_INK);
      doc.text("Saúde dos projetos", margin, yc);
      drawHBars(doc, margin, yc + 4, colW, [
        { label: "No prazo", value: healthCounts.verde, color: HEALTH.verde, total: ps.length },
        { label: "Atenção", value: healthCounts.amarelo, color: HEALTH.amarelo, total: ps.length },
        { label: "Crítico", value: healthCounts.vermelho, color: HEALTH.vermelho, total: ps.length },
      ]);

      // Fase (right)
      const xR = margin + colW + 8;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C_INK);
      doc.text("Projetos por fase", xR, yc);
      drawHBars(doc, xR, yc + 4, colW,
        Object.entries(statusCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ label: fmtStatus(k), value: v, color: C_BRAND, total: ps.length }))
      );

      // Drift por projeto
      const drift = ps
        .filter((p) => p.end_date && p.baseline_end_date && p.status !== "cancelado")
        .map((p) => {
          const d = Math.round((new Date(p.end_date!).getTime() - new Date(p.baseline_end_date!).getTime()) / 86400000);
          return { name: p.code || p.name.substring(0, 22), value: d };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

      if (drift.length) {
        const yd = yc + 90;
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C_INK);
        doc.text("Desvio de prazo (dias)", margin, yd);
        drawDivergingBars(doc, margin, yd + 4, pageW - margin * 2, drift,
          (v) => v > 0 ? C_BAD : v < 0 ? C_OK : C_MUTED,
          (v) => v > 0 ? `+${v} d` : `${v} d`);
      }

      // Variação orçamentária
      const bud = ps
        .filter((p) => Number(p.budget_planned || 0) || Number(p.budget_spent || 0))
        .map((p) => {
          const pl = Number(p.budget_planned || 0);
          const gp = Number(p.budget_spent || 0);
          return { name: p.code || p.name.substring(0, 22), value: gp - pl, pct: pl > 0 ? Math.round(gp / pl * 100) : 0 };
        })
        .sort((a, b) => b.value - a.value);

      if (bud.length) {
        doc.addPage();
        pageHeader(doc, "Variação orçamentária", pf, ctx);
        autoTable(doc, {
          startY: 38,
          margin: { left: margin, right: margin },
          head: [["Projeto", "Variação (R$)", "Consumo (%)"]],
          body: bud.map((b) => [b.name, fmtBRL(b.value), `${b.pct}%`]),
          headStyles: { fillColor: C_INK, textColor: C_BRAND, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: C_INK },
          alternateRowStyles: { fillColor: C_BG_SOFT },
          styles: { lineColor: C_LINE, lineWidth: 0.1, cellPadding: 2 },
          columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
          didParseCell: (d) => {
            if (d.section === "body" && d.column.index === 1) {
              const raw = bud[d.row.index].value;
              d.cell.styles.textColor = raw > 0 ? C_BAD : raw < 0 ? C_OK : C_INK;
            }
          },
        });
      }

      // ── Lista de projetos
      doc.addPage();
      pageHeader(doc, "Projetos do programa", pf, ctx);
      autoTable(doc, {
        startY: 38,
        margin: { left: margin, right: margin },
        head: [["Código", "Projeto", "Status", "Saúde", "Início", "Baseline", "Previsto", "Desvio"]],
        body: [...ps]
          .sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"))
          .map((p) => {
            let dr = "—";
            if (p.end_date && p.baseline_end_date) {
              const d = Math.round((new Date(p.end_date).getTime() - new Date(p.baseline_end_date).getTime()) / 86400000);
              dr = d > 0 ? `+${d} d` : `${d} d`;
            }
            return [
              p.code || "—", p.name, fmtStatus(p.status), fmtHealth(p.health),
              fmtDate(p.start_date), fmtDate(p.baseline_end_date), fmtDate(p.end_date), dr,
            ];
          }),
        headStyles: { fillColor: C_INK, textColor: C_BRAND, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: C_INK },
        alternateRowStyles: { fillColor: C_BG_SOFT },
        styles: { lineColor: C_LINE, lineWidth: 0.1, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 22, font: "courier", fontSize: 8 },
          1: { cellWidth: "auto" },
          7: { halign: "right", fontStyle: "bold" },
        },
      });

      // ── Gantt vetorial
      doc.addPage();
      pageHeader(doc, "Gantt do programa", pf, ctx);
      // Compute end fallback from tasks when project has no end_date
      const taskEndByProject = new Map<string, number>();
      ts.forEach((t: any) => {
        if (!t.end_date) return;
        const cur = taskEndByProject.get(t.project_id) || 0;
        const ts2 = new Date(t.end_date + "T00:00:00").getTime();
        if (ts2 > cur) taskEndByProject.set(t.project_id, ts2);
      });
      const psForGantt = ps.map((p) => {
        if (p.end_date) return p;
        const fromTasks = taskEndByProject.get(p.id);
        if (fromTasks) return { ...p, end_date: new Date(fromTasks).toISOString().slice(0, 10) };
        if (p.start_date) {
          const d = new Date(p.start_date + "T00:00:00");
          d.setDate(d.getDate() + 90);
          return { ...p, end_date: d.toISOString().slice(0, 10) };
        }
        return p;
      });
      drawProgramGantt(doc, margin, 40, pageW - margin * 2, pageH - 60, psForGantt);

      // ── Top riscos
      if (risks && risks.length) {
        doc.addPage();
        pageHeader(doc, "Top riscos", pf, ctx);
        autoTable(doc, {
          startY: 38,
          margin: { left: margin, right: margin },
          head: [["Descrição", "Status", "Exposição"]],
          body: risks.map((r) => [r.description, r.status, String(r.exposure ?? "—")]),
          headStyles: { fillColor: C_INK, textColor: C_BRAND, fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: C_INK },
          alternateRowStyles: { fillColor: C_BG_SOFT },
          styles: { lineColor: C_LINE, lineWidth: 0.1, cellPadding: 2 },
          columnStyles: { 2: { halign: "right", fontStyle: "bold", cellWidth: 25 } },
        });
      }

      paginate(doc, brandFooter);
      const safe = programName.replace(/[^a-zA-Z0-9]+/g, "_") || "programa";
      doc.save(`programa-${safe}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading} variant="outline" size="sm">
      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
      Exportar PDF
    </Button>
  );
}

function drawHBars(
  doc: jsPDF,
  x: number, y: number, w: number,
  rows: { label: string; value: number; color: [number, number, number]; total: number }[],
) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowH = 14;
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...C_INK);
    doc.text(r.label, x, ry + 4);
    const pct = r.total > 0 ? Math.round((r.value / r.total) * 100) : 0;
    doc.setTextColor(...C_MUTED); doc.setFontSize(8);
    doc.text(`${r.value} (${pct}%)`, x + w, ry + 4, { align: "right" });
    doc.setFillColor(...C_LINE);
    doc.roundedRect(x, ry + 6, w, 4, 1, 1, "F");
    const fw = (r.value / max) * w;
    doc.setFillColor(...r.color);
    doc.roundedRect(x, ry + 6, Math.max(0.5, fw), 4, 1, 1, "F");
  });
}

function drawDivergingBars(
  doc: jsPDF,
  x: number, y: number, w: number,
  rows: { name: string; value: number }[],
  colorOf: (v: number) => [number, number, number],
  fmtVal: (v: number) => string,
) {
  const labelW = 50;
  const valueW = 22;
  const chartX = x + labelW;
  const chartW = w - labelW - valueW;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const cx = chartX + chartW / 2;
  const rowH = 8;
  // axis
  doc.setDrawColor(...C_LINE); doc.line(cx, y, cx, y + rows.length * rowH);
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...C_INK);
    doc.text(r.name, x, ry + 5, { maxWidth: labelW - 2 });
    const halfW = (Math.abs(r.value) / max) * (chartW / 2);
    doc.setFillColor(...colorOf(r.value));
    if (r.value >= 0) doc.rect(cx, ry + 2, halfW, 4, "F");
    else doc.rect(cx - halfW, ry + 2, halfW, 4, "F");
    doc.setTextColor(...C_MUTED);
    doc.text(fmtVal(r.value), x + w, ry + 5, { align: "right" });
  });
}

function drawProgramGantt(doc: jsPDF, x: number, y: number, w: number, h: number, projects: any[]) {
  const items = projects
    .filter((p) => p.start_date && (p.end_date || p.baseline_end_date))
    .map((p) => ({ ...p, _end: p.end_date || p.baseline_end_date }))
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

  if (!items.length) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...C_MUTED);
    doc.text("Sem projetos com datas definidas.", x, y);
    return;
  }
  const parse = (d: string) => new Date(d + "T00:00:00").getTime();
  const dayMs = 86400000;
  const minTs = Math.min(...items.map((p) => parse(p.start_date)));
  const maxTs = Math.max(...items.map((p) =>
    Math.max(parse(p._end), p.baseline_end_date ? parse(p.baseline_end_date) : 0)));

  const labelW = 55;
  const chartX = x + labelW;
  const chartW = w - labelW;
  const totalDays = Math.max(1, Math.round((maxTs - minTs) / dayMs));

  // Month markers header
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...C_MUTED);
  const cursor = new Date(minTs); cursor.setDate(1);
  while (cursor.getTime() <= maxTs) {
    const left = ((cursor.getTime() - minTs) / dayMs / totalDays) * chartW;
    if (left >= 0 && left <= chartW) {
      doc.setDrawColor(...C_LINE); doc.line(chartX + left, y, chartX + left, y + 4 + items.length * 7);
      doc.text(cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        chartX + left + 0.5, y + 3);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Today line
  const today = Date.now();
  if (today >= minTs && today <= maxTs) {
    const tl = ((today - minTs) / dayMs / totalDays) * chartW;
    doc.setDrawColor(...C_BAD); doc.setLineWidth(0.5);
    doc.line(chartX + tl, y + 5, chartX + tl, y + 5 + items.length * 7);
    doc.setLineWidth(0.2);
  }

  const rowsStart = y + 6;
  items.forEach((p, i) => {
    const ry = rowsStart + i * 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C_INK);
    if (p.code) {
      doc.setTextColor(...C_MUTED); doc.setFontSize(6.5);
      doc.text(String(p.code), x, ry + 2.5);
    }
    doc.setTextColor(...C_INK); doc.setFontSize(7.5);
    doc.text(String(p.name).substring(0, 30), x, ry + 5.5, { maxWidth: labelW - 2 });

    const s = parse(p.start_date);
    const e = parse(p._end);
    const left = ((s - minTs) / dayMs / totalDays) * chartW;
    const width = Math.max(0.5, ((e - s) / dayMs / totalDays) * chartW);
    const color = HEALTH[p.health as string] || C_BRAND;

    if (p.baseline_end_date) {
      const be = parse(p.baseline_end_date);
      const bw = Math.max(0.5, ((be - s) / dayMs / totalDays) * chartW);
      doc.setFillColor(...color);
      doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
      doc.rect(chartX + left, ry + 1, bw, 1.5, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    }
    doc.setFillColor(...color);
    doc.roundedRect(chartX + left, ry + 3, width, 2.5, 0.5, 0.5, "F");
  });

  // Legenda
  const yL = rowsStart + items.length * 7 + 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...C_MUTED);
  doc.setFillColor(...C_OK); doc.rect(x, yL, 3, 2, "F");
  doc.text("Saudável", x + 5, yL + 1.8);
  doc.setFillColor(234, 179, 8); doc.rect(x + 35, yL, 3, 2, "F");
  doc.text("Atenção", x + 40, yL + 1.8);
  doc.setFillColor(...C_BAD); doc.rect(x + 73, yL, 3, 2, "F");
  doc.text("Crítico", x + 78, yL + 1.8);
  doc.setDrawColor(...C_BAD); doc.line(x + 110, yL - 0.5, x + 110, yL + 2.5);
  doc.text("Hoje", x + 112, yL + 1.8);
}
