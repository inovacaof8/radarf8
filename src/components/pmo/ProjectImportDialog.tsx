import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface ParsedRow {
  macro: string;
  title: string;
  description: string;
  assigneeExternal: string;
  status: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  baselineStart: string | null;
  baselineEnd: string | null;
  progress: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName?: string;
  defaultPortfolioId?: string;
  defaultProgramId?: string;
}

const STATUS_MAP: Record<string, string> = {
  "backlog": "backlog", "a fazer": "backlog", "todo": "backlog",
  "em andamento": "em_andamento", "em execução": "em_andamento", "fazendo": "em_andamento",
  "concluído": "concluido", "concluida": "concluido", "concluido": "concluido", "feito": "concluido",
  "bloqueado": "bloqueado", "blocked": "bloqueado",
  "cancelado": "cancelado",
};
const PRIO_MAP: Record<string, string> = {
  "baixa": "baixa", "low": "baixa",
  "média": "media", "media": "media", "medium": "media",
  "alta": "alta", "high": "alta",
  "crítica": "critica", "critica": "critica", "urgente": "critica",
};

function toISO(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0"), mo = m[2].padStart(2, "0");
    let y = m[3]; if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function pick(r: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    for (const rk of Object.keys(r)) {
      if (rk.toLowerCase().trim() === k.toLowerCase().trim()) return r[rk];
    }
  }
  return undefined;
}

export default function ProjectImportDialog({ open, onOpenChange, defaultName = "", defaultPortfolioId, defaultProgramId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [projectName, setProjectName] = useState(defaultName);
  const [projectCode, setProjectCode] = useState("");
  const [portfolioId, setPortfolioId] = useState<string>(defaultPortfolioId || "none");
  const [programId, setProgramId] = useState<string>(defaultProgramId || "none");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const portfolios = useQuery({
    queryKey: ["pi-portfolios"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name").order("name");
      return data || [];
    },
  });
  const programs = useQuery({
    queryKey: ["pi-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("program").select("id, name, portfolio_id").order("name");
      return data || [];
    },
  });
  const filteredPrograms = (programs.data || []).filter(p => portfolioId === "none" || p.portfolio_id === portfolioId);

  const reset = () => {
    setStep("upload"); setRows([]); setErrors([]);
    setProjectName(defaultName); setProjectCode("");
    setPortfolioId(defaultPortfolioId || "none"); setProgramId(defaultProgramId || "none");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Macro entrega", "Título *", "Descrição", "Responsável externo (nome livre)", "Status", "Prioridade", "Início", "Fim", "Baseline início", "Baseline fim", "Progresso (%)"],
      ["Diagnóstico", "Levantar contratos vigentes", "Identificar todos os contratos em execução", "João Silva", "Backlog", "Média", "2026-06-01", "2026-06-15", "", "", 0],
      ["Diagnóstico", "Consolidar contratos", "Organizar em repositório único", "", "Backlog", "Alta", "", "", "", "", 0],
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 40 }, { wch: 50 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atividades");
    XLSX.writeFile(wb, "modelo_importacao_projeto.xlsx");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary", cellDates: true });
        const sheetName = wb.SheetNames.find(n => /atividade|tarefa|task|contrato|desdobramento/i.test(n)) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Read as raw matrix to detect header row automatically
        const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: false }) as any[][];
        if (!aoa.length) { setErrors(["Planilha vazia."]); return; }

        const KEYWORDS = [
          "título", "titulo", "title", "tarefa", "atividade",
          "macro", "entrega", "fase", "phase",
          "tipo", "id",
          "descrição", "descricao", "description", "o que fazer",
          "responsável", "responsavel", "assignee", "quem executa",
          "status", "prioridade", "priority",
          "início", "inicio", "start", "fim", "end", "prazo", "periodicidade",
          "baseline", "progresso", "progress",
        ];
        const score = (row: any[]) => row.reduce((acc, c) => {
          const s = String(c ?? "").toLowerCase().trim();
          if (!s) return acc;
          return acc + (KEYWORDS.some(k => s.includes(k)) ? 1 : 0);
        }, 0);

        // Find header row in the first 15 rows: row with the most keyword hits (>=2)
        let headerIdx = 0;
        let bestScore = -1;
        const scanMax = Math.min(aoa.length, 15);
        for (let i = 0; i < scanMax; i++) {
          const sc = score(aoa[i]);
          if (sc > bestScore) { bestScore = sc; headerIdx = i; }
        }
        if (bestScore < 2) {
          setErrors(["Não foi possível identificar a linha de cabeçalho. Verifique se a planilha tem uma linha com colunas como 'Título', 'Macro entrega' / 'Tarefa' etc."]);
          return;
        }

        const headerRow = aoa[headerIdx].map((c) => String(c ?? "").trim());
        const dataRows = aoa.slice(headerIdx + 1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
        const data = dataRows.map((r) => {
          const obj: Record<string, any> = {};
          headerRow.forEach((h, i) => { if (h) obj[h] = r[i]; });
          return obj;
        });
        if (data.length === 0) { setErrors(["Nenhuma linha de dados encontrada."]); return; }

        // Detect hierarchical layout: a TIPO column with MACRO/ENTREGA/TAREFA values
        const tipoKey = headerRow.find(h => h && /^tipo$/i.test(h.trim()));
        const titleKey = headerRow.find(h => h && /(macro\s*\/?\s*entrega\s*\/?\s*tarefa|t[íi]tulo|tarefa|atividade|title)/i.test(h));
        const isHierarchical = !!tipoKey && data.some(r => /macro|entrega/i.test(String(r[tipoKey] ?? "")));

        const errs: string[] = [];
        const parsed: ParsedRow[] = [];

        if (isHierarchical) {
          // Build phases/deliverables/tasks based on TIPO column
          let currentMacro = "Geral";
          let currentEntrega = "";
          data.forEach((r, i) => {
            const tipo = String(r[tipoKey!] ?? "").trim().toUpperCase();
            const titleVal = String((titleKey ? r[titleKey] : "") ?? "").trim();
            const desc = String(pick(r, ["O QUE FAZER CONCRETAMENTE", "Descrição", "Descricao", "Description"]) ?? "").trim();
            const assignee = String(pick(r, ["QUEM EXECUTA", "Responsável externo (nome livre)", "Responsável externo", "Responsável", "Responsavel", "Assignee"]) ?? "").trim();
            const prazo = String(pick(r, ["PRAZO / PERIODICIDADE", "Prazo", "Periodicidade"]) ?? "").trim();
            const prioRaw = String(pick(r, ["PRIORIDADE", "Prioridade", "Priority"]) ?? "").trim().toLowerCase();
            const statusRaw = String(pick(r, ["Status", "STATUS"]) ?? "").trim().toLowerCase();

            if (tipo === "MACRO") {
              currentMacro = titleVal || `Macro ${i + 1}`;
              currentEntrega = "";
              return;
            }
            if (tipo === "ENTREGA") {
              currentEntrega = titleVal || `Entrega ${i + 1}`;
              // Also turn deliverable into a task so it's visible/tracked
              if (!titleVal) return;
              parsed.push({
                macro: currentMacro,
                title: titleVal,
                description: [desc, prazo ? `Prazo: ${prazo}` : ""].filter(Boolean).join("\n"),
                assigneeExternal: assignee,
                status: STATUS_MAP[statusRaw] || "backlog",
                priority: PRIO_MAP[prioRaw] || "media",
                startDate: null, endDate: null, baselineStart: null, baselineEnd: null,
                progress: 0,
              });
              return;
            }
            // Qualquer outro TIPO (TAREFA, REGISTRAR, CONTRATAR, COMPRAR, EXECUTAR, EMITIR, etc.) ou vazio = tarefa
            if (!titleVal) return; // skip blank rows silently
            const tipoLabel = tipo && tipo !== "TAREFA" ? `[${tipo}] ` : "";
            parsed.push({
              macro: currentMacro,
              title: currentEntrega ? `${currentEntrega} — ${tipoLabel}${titleVal}` : `${tipoLabel}${titleVal}`,
              description: [desc, prazo ? `Prazo: ${prazo}` : ""].filter(Boolean).join("\n"),
              assigneeExternal: assignee,
              status: STATUS_MAP[statusRaw] || "backlog",
              priority: PRIO_MAP[prioRaw] || "media",
              startDate: toISO(pick(r, ["Início", "Inicio", "Start"])),
              endDate: toISO(pick(r, ["Fim", "End"])),
              baselineStart: toISO(pick(r, ["Baseline início", "Baseline inicio"])),
              baselineEnd: toISO(pick(r, ["Baseline fim"])),
              progress: Number(pick(r, ["Progresso (%)", "Progresso", "Progress"]) || 0) || 0,
            });
          });
        } else {
          data.forEach((r, i) => {
            const title = String(pick(r, ["Título *", "Título", "Titulo", "Title", "Atividade", "Tarefa"]) ?? "").trim();
            if (!title) {
              errs.push(`Linha ${headerIdx + 2 + i}: Título vazio`);
              return;
            }
            const macro = String(pick(r, ["Macro entrega", "Macro", "Fase", "Phase"]) ?? "").trim() || "Geral";
            const description = String(pick(r, ["Descrição", "Descricao", "Description"]) ?? "").trim();
            const assigneeExternal = String(pick(r, ["Responsável externo (nome livre)", "Responsável externo", "Responsável", "Responsavel", "Assignee"]) ?? "").trim();
            const statusRaw = String(pick(r, ["Status"]) ?? "").trim().toLowerCase();
            const prioRaw = String(pick(r, ["Prioridade", "Priority"]) ?? "").trim().toLowerCase();
            parsed.push({
              macro, title, description, assigneeExternal,
              status: STATUS_MAP[statusRaw] || "backlog",
              priority: PRIO_MAP[prioRaw] || "media",
              startDate: toISO(pick(r, ["Início", "Inicio", "Start"])),
              endDate: toISO(pick(r, ["Fim", "End"])),
              baselineStart: toISO(pick(r, ["Baseline início", "Baseline inicio"])),
              baselineEnd: toISO(pick(r, ["Baseline fim"])),
              progress: Number(pick(r, ["Progresso (%)", "Progresso", "Progress"]) || 0) || 0,
            });
          });
        }

        if (parsed.length === 0) {
          setErrors([...errs, "Nenhuma tarefa válida encontrada após o cabeçalho."]);
          return;
        }
        setErrors(errs); setRows(parsed); setStep("preview");
      } catch (err: any) {
        setErrors(["Erro ao ler arquivo: " + (err?.message || "formato inválido")]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!projectName.trim()) { toast.error("Informe o nome do projeto"); return; }
    if (rows.length === 0) return;
    setStep("importing");
    try {
      // Create project
      const { data: proj, error: pErr } = await supabase
        .from("project")
        .insert({
          name: projectName.trim(),
          code: projectCode.trim() || null,
          status: "planejamento",
          health: "verde",
          portfolio_id: portfolioId === "none" ? null : portfolioId,
          program_id: programId === "none" ? null : programId,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      const projectId = proj.id;

      // Create phases AND deliverables (unique macro entregas, preserving order)
      const macros: string[] = [];
      rows.forEach(r => { if (!macros.includes(r.macro)) macros.push(r.macro); });
      const phaseMap: Record<string, string> = {};
      const delivMap: Record<string, string> = {};
      for (let i = 0; i < macros.length; i++) {
        const { data: ph, error: phErr } = await supabase
          .from("phase")
          .insert({ project_id: projectId, name: macros[i], ordering: i })
          .select("id")
          .single();
        if (phErr) throw phErr;
        phaseMap[macros[i]] = ph.id;

        const { data: dl, error: dlErr } = await supabase
          .from("project_deliverable")
          .insert({ project_id: projectId, title: macros[i], order_index: i })
          .select("id")
          .single();
        if (dlErr) throw dlErr;
        delivMap[macros[i]] = dl.id;
      }

      // Create tasks in batches
      const tasksPayload = rows.map((r, idx) => ({
        project_id: projectId,
        phase_id: phaseMap[r.macro],
        deliverable_id: delivMap[r.macro],
        name: r.title,
        title: r.title,
        description: r.description || null,
        assignee_external_name: r.assigneeExternal || null,
        status: r.status,
        priority: r.priority,
        start_date: r.startDate,
        end_date: r.endDate,
        baseline_start_date: r.baselineStart,
        baseline_end_date: r.baselineEnd,
        progress: Math.max(0, Math.min(100, r.progress)),
        order_index: idx,
      }));
      const chunkSize = 100;
      for (let i = 0; i < tasksPayload.length; i += chunkSize) {
        const chunk = tasksPayload.slice(i, i + chunkSize);
        const { error } = await supabase.from("task").insert(chunk);
        if (error) throw error;
      }

      toast.success(`Projeto criado com ${macros.length} fases e ${rows.length} tarefas`);
      qc.invalidateQueries({ queryKey: ["projects"] });
      handleClose(false);
      navigate(`/projetos/${projectId}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
      setStep("preview");
    }
  };

  const phaseCount = new Set(rows.map(r => r.macro)).size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar Projeto via Planilha
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Crie um projeto completo com fases e tarefas a partir de uma planilha .xlsx. Cada "Macro entrega" vira uma fase.
          </p>
        </DialogHeader>

        {step === "upload" && (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome do projeto *</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex: PLANO DE IMPLEMENTAÇÃO DE GOVERNANÇA" />
                </div>
                <div className="space-y-2">
                  <Label>Código (opcional)</Label>
                  <Input value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder="PROJ-2026-001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Portfólio</Label>
                  <Select value={portfolioId} onValueChange={(v) => { setPortfolioId(v); setProgramId("none"); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {(portfolios.data || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Programa (opcional)</Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {filteredPrograms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center space-y-4">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Selecione um arquivo .xlsx ou .csv</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Selecionar Arquivo</Button>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Colunas esperadas</h4>
                <p className="text-xs text-muted-foreground">
                  <code className="text-xs">Macro entrega</code>, <code className="text-xs">Título *</code>, <code className="text-xs">Descrição</code>, <code className="text-xs">Responsável externo</code>, <code className="text-xs">Status</code>, <code className="text-xs">Prioridade</code>, <code className="text-xs">Início</code>, <code className="text-xs">Fim</code>, <code className="text-xs">Baseline início</code>, <code className="text-xs">Baseline fim</code>, <code className="text-xs">Progresso (%)</code>.
                </p>
                <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> Baixar Modelo
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">{errors.length} aviso(s):</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5 max-h-20 overflow-auto">
                    {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">{phaseCount} fase(s)</Badge>
              <Badge variant="secondary">{rows.length} tarefa(s)</Badge>
              <span className="text-muted-foreground text-xs">Projeto: <strong className="text-foreground">{projectName || "—"}</strong></span>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fase</TableHead>
                    <TableHead className="text-xs">Tarefa</TableHead>
                    <TableHead className="text-xs">Responsável</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Início</TableHead>
                    <TableHead className="text-xs">Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{r.macro}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate" title={r.title}>{r.title}</TableCell>
                      <TableCell className="text-xs">{r.assigneeExternal || "—"}</TableCell>
                      <TableCell className="text-xs">{r.status}</TableCell>
                      <TableCell className="text-xs">{r.startDate || "—"}</TableCell>
                      <TableCell className="text-xs">{r.endDate || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={!projectName.trim() || rows.length === 0} className="gap-2">
                Criar projeto e importar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Criando projeto, fases e tarefas...</p>
          </div>
        )}

        {step === "upload" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
