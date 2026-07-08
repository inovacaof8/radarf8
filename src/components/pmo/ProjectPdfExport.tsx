import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  C_INK, C_BRAND, C_MUTED, C_LINE, C_BG_SOFT,
  fmtBRL, fmtNum, fmtDate, fmtHealth, fmtStatus,
  pageHeader, paginate, drawCover, drawKpiGrid, captureElementImage,
} from "@/lib/pdfTheme";

interface Props {
  projectId: string;
  projectName: string;
  projectCode?: string | null;
}

export default function ProjectPdfExport({ projectId, projectName, projectCode }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const [{ data: project }, { data: deliverables }, { data: tasks }] = await Promise.all([
        supabase
          .from("project")
          .select("*, program:program_id(name), portfolio:portfolio_id(name)")
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("project_deliverable")
          .select("*")
          .eq("project_id", projectId)
          .order("order_index"),
        supabase
          .from("task")
          .select("*")
          .eq("project_id", projectId)
          .order("order_index"),
      ]);

      const userIds = Array.from(new Set([
        ...(tasks || []).map((t: any) => t.assignee_id).filter(Boolean),
        project?.manager_id,
      ].filter(Boolean) as string[]));
      const profiles = userIds.length
        ? await supabase.from("profiles").select("user_id, name").in("user_id", userIds)
        : { data: [] as any[] };
      const nameById = new Map((profiles.data || []).map((p: any) => [p.user_id, p.name]));

      // Capture Gantt if visible
      let ganttImg: { dataUrl: string; w: number; h: number } | null = null;
      try {
        ganttImg = await captureElementImage("[data-gantt-export]");
      } catch { /* ignore */ }

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;

      const portfolioName = (project as any)?.portfolio?.name || "Portfolio";
      const programName = (project as any)?.program?.name || "Programa";
      const ctx = `${portfolioName} · ${programName} · ${project?.name || projectName}`;
      const brandFooter = `${portfolioName} · ${programName}`;

      // Cover
      drawCover(
        doc,
        portfolioName,
        programName,
        project?.name || projectName,
        "Relatório Executivo do Projeto",
        [
          projectCode ? `Código: ${projectCode}` : "",
          `Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
        ].filter(Boolean),
      );

      // Page 2: dados gerais + KPIs
      doc.addPage();
      pageHeader(doc, "Dados gerais", portfolioName, ctx);

      const totalTasks = (tasks || []).length;
      const doneTasks = (tasks || []).filter((t: any) => t.status === "concluida").length;
      const avgProgress = totalTasks
        ? Math.round((tasks || []).reduce((s: number, t: any) => s + (t.progress || 0), 0) / totalTasks)
        : 0;

      const yAfter = drawKpiGrid(doc, 38, [
        ["Status", fmtStatus(project?.status)],
        ["Saúde", fmtHealth(project?.health)],
        ["Progresso médio", `${avgProgress}%`],
        ["Atividades", `${doneTasks} / ${totalTasks}`],
        ["Início", fmtDate(project?.start_date)],
        ["Término previsto", fmtDate(project?.end_date)],
      ], 3);

      // Tabela dados
      autoTable(doc, {
        startY: yAfter + 4,
        margin: { left: margin, right: margin },
        body: [
          ["Gestor", nameById.get(project?.manager_id) || "—"],
          ["Baseline término", fmtDate(project?.baseline_end_date)],
          ["Orçamento previsto", fmtBRL(project?.budget_planned)],
          ["Orçamento gasto", fmtBRL(project?.budget_spent)],
        ],
        styles: { fontSize: 9.5, lineColor: C_LINE, lineWidth: 0.1, cellPadding: 2.5 },
        bodyStyles: { textColor: C_INK },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50, textColor: C_MUTED, fillColor: C_BG_SOFT },
        },
      });

      const yAfterTbl = (doc as any).lastAutoTable.finalY + 6;

      if (project?.description) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...C_INK);
        doc.text("Descrição", margin, yAfterTbl);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...C_INK);
        const lines = doc.splitTextToSize(project.description, pageW - margin * 2);
        doc.text(lines, margin, yAfterTbl + 6);
      }

      // Page 3: Gantt
      if (ganttImg) {
        doc.addPage();
        pageHeader(doc, "Cronograma · Gantt", portfolioName, ctx);
        const maxW = pageW - margin * 2;
        const maxH = pageH - 60;
        const ratio = ganttImg.h / ganttImg.w;
        let w = maxW;
        let h = w * ratio;
        if (h > maxH) { h = maxH; w = h / ratio; }
        doc.addImage(ganttImg.dataUrl, "PNG", margin, 38, w, h);
      }

      // Pages: Macro entregas e atividades
      doc.addPage();
      pageHeader(doc, "Macro entregas e atividades", portfolioName, ctx);

      const orphan = (tasks || []).filter((t: any) => !t.deliverable_id);
      const blocks = [
        ...((deliverables || []).map((d: any) => ({
          title: d.title,
          status: d.status,
          progress: d.progress,
          tasks: (tasks || []).filter((t: any) => t.deliverable_id === d.id),
        }))),
        ...(orphan.length ? [{ title: "Sem macro entrega", status: "", progress: 0, tasks: orphan }] : []),
      ];

      let cursorY = 38;
      const ensureSpace = (need: number) => {
        if (cursorY + need > pageH - 16) {
          doc.addPage();
          pageHeader(doc, "Macro entregas e atividades", portfolioName, ctx);
          cursorY = 38;
        }
      };

      if (!blocks.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...C_MUTED);
        doc.text("Nenhuma macro entrega cadastrada.", margin, cursorY);
      }

      for (const b of blocks) {
        ensureSpace(14);
        // Header bar
        doc.setFillColor(...C_BG_SOFT);
        doc.rect(margin, cursorY, pageW - margin * 2, 8, "F");
        doc.setFillColor(...C_BRAND);
        doc.rect(margin, cursorY, 1.5, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...C_INK);
        doc.text(b.title, margin + 4, cursorY + 5.5, { maxWidth: pageW - margin * 2 - 60 });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...C_MUTED);
        const meta = `${b.tasks.length} ${b.tasks.length === 1 ? "atividade" : "atividades"}`;
        doc.text(meta, pageW - margin - 2, cursorY + 5.5, { align: "right" });
        cursorY += 9;

        if (b.tasks.length) {
          autoTable(doc, {
            startY: cursorY,
            margin: { left: margin, right: margin },
            head: [["Atividade", "Responsável", "Início", "Fim", "Status", "%"]],
            body: b.tasks.map((t: any) => [
              t.title || t.name || "—",
              nameById.get(t.assignee_id) || t.assignee_external_name || "—",
              fmtDate(t.start_date),
              fmtDate(t.end_date),
              fmtStatus(t.status),
              `${t.progress || 0}%`,
            ]),
            headStyles: { fillColor: C_INK, textColor: C_BRAND, fontStyle: "bold", fontSize: 8.5 },
            bodyStyles: { fontSize: 8.5, textColor: C_INK },
            alternateRowStyles: { fillColor: [250, 251, 253] as any },
            styles: { lineColor: C_LINE, lineWidth: 0.1, cellPadding: 1.8 },
            columnStyles: {
              0: { cellWidth: "auto" },
              5: { halign: "right", fontStyle: "bold", cellWidth: 14 },
            },
          });
          cursorY = (doc as any).lastAutoTable.finalY + 4;
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8.5);
          doc.setTextColor(...C_MUTED);
          doc.text("Sem atividades", margin + 4, cursorY + 4);
          cursorY += 8;
        }
      }

      paginate(doc, brandFooter);
      const safe = (projectCode || project?.name || "projeto").replace(/[^a-zA-Z0-9]+/g, "_");
      doc.save(`projeto-${safe}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading} variant="ghost" size="icon" title="Exportar PDF">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
    </Button>
  );
}
