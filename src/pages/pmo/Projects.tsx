import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import PageHeader from "@/components/pmo/PageHeader";
import { StatusBadge, HealthBadge } from "@/components/pmo/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, ExternalLink, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import ProjectPdfExport from "@/components/pmo/ProjectPdfExport";
import ProjectImportDialog from "@/components/pmo/ProjectImportDialog";

type Project = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  status: string;
  health: string;
  manager_id: string | null;
  program_id: string | null;
  portfolio_id: string | null;
  start_date: string | null;
  end_date: string | null;
  baseline_end_date: string | null;
  budget_planned: number | null;
  budget_spent: number | null;
  program?: { name: string } | null;
  portfolio?: { name: string } | null;
};

const PROJECT_STATUS = [
  { v: "iniciacao", l: "Iniciação" },
  { v: "planejamento", l: "Planejamento" },
  { v: "execucao", l: "Execução" },
  { v: "monitoramento", l: "Monitoramento" },
  { v: "encerramento", l: "Encerramento" },
  { v: "cancelado", l: "Cancelado" },
];
const HEALTH_OPTIONS = [
  { v: "verde", l: "Saudável" },
  { v: "amarelo", l: "Atenção" },
  { v: "vermelho", l: "Crítico" },
];

export default function ProjectsPage() {
  const { isAdmin, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [importing, setImporting] = useState(false);
  const canManage = isAdmin
    || hasPermission("project", "create")
    || hasPermission("project", "edit")
    || hasPermission("project", "delete")
    || hasPermission("project", "admin");

  const list = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project")
        .select("id, code, name, description, status, health, manager_id, program_id, portfolio_id, start_date, end_date, baseline_end_date, budget_planned, budget_spent, program:program_id(name), portfolio:portfolio_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Project[];
    },
  });

  const programs = useQuery({
    queryKey: ["programs-opts"],
    queryFn: async () => {
      const { data } = await supabase.from("program").select("id, name, portfolio_id").order("name");
      return data || [];
    },
  });

  const portfolios = useQuery({
    queryKey: ["portfolios-opts"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name").order("name");
      return data || [];
    },
  });

  const filtered = (list.data || []).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.code || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Project> & { id?: string }) => {
      const payload = {
        code: input.code || null,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? "iniciacao",
        health: input.health ?? "verde",
        program_id: input.program_id || null,
        portfolio_id: input.portfolio_id || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        baseline_end_date: input.baseline_end_date || null,
        budget_planned: input.budget_planned ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("project").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Projeto salvo");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditing(null); setCreating(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto removido");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <div>
      <PageHeader
        title="Projetos"
        description="Iniciativas com escopo, prazo e orçamento definidos."
        actions={canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImporting(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar planilha
            </Button>
            <Button onClick={() => setCreating(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </div>
        )}
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {PROJECT_STATUS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhum projeto.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Saúde</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="w-[220px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code || "—"}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.program?.name || p.portfolio?.name || "—"}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell><HealthBadge h={p.health} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.end_date ? new Date(p.end_date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ProjectPdfExport projectId={p.id} projectName={p.name} projectCode={p.code} />
                        <Link to={`/projetos/${p.id}`}>
                          <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                        </Link>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProjectSheet
        open={creating || !!editing}
        project={editing}
        programs={programs.data || []}
        portfolios={portfolios.data || []}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" e todos os dados vinculados (tarefas, fases, riscos) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectImportDialog open={importing} onOpenChange={setImporting} defaultName="PLANO DE IMPLEMENTAÇÃO DE GOVERNANÇA" />
    </div>
  );
}

function ProjectSheet({
  open, project, programs, portfolios, onClose, onSave, saving,
}: {
  open: boolean;
  project: Project | null;
  programs: { id: string; name: string; portfolio_id: string }[];
  portfolios: { id: string; name: string }[];
  onClose: () => void;
  onSave: (p: Partial<Project> & { id?: string }) => void;
  saving: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("iniciacao");
  const [health, setHealth] = useState("verde");
  const [programId, setProgramId] = useState<string>("none");
  const [portfolioId, setPortfolioId] = useState<string>("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [baselineEnd, setBaselineEnd] = useState("");
  const [budget, setBudget] = useState("");

  useEffect(() => {
    if (open) {
      setCode(project?.code ?? "");
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setStatus(project?.status ?? "iniciacao");
      setHealth(project?.health ?? "verde");
      setProgramId(project?.program_id ?? "none");
      setPortfolioId(project?.portfolio_id ?? "none");
      setStartDate(project?.start_date ?? "");
      setEndDate(project?.end_date ?? "");
      setBaselineEnd(project?.baseline_end_date ?? "");
      setBudget(project?.budget_planned?.toString() ?? "");
    }
  }, [open, project]);

  // Auto-preenche portfolio quando seleciona programa
  useEffect(() => {
    if (programId !== "none") {
      const prog = programs.find(p => p.id === programId);
      if (prog) setPortfolioId(prog.portfolio_id);
    }
  }, [programId, programs]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{project ? "Editar projeto" : "Novo projeto"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PROJ-2026-001" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Programa</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Portfolio</Label>
              <Select value={portfolioId} onValueChange={setPortfolioId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saúde</Label>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEALTH_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Baseline fim</Label>
              <Input type="date" value={baselineEnd} onChange={(e) => setBaselineEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Orçamento planejado (R$)</Label>
            <Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name.trim() || saving}
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({
              id: project?.id,
              code: code.trim() || null,
              name: name.trim(),
              description: description.trim() || null,
              status,
              health,
              program_id: programId === "none" ? null : programId,
              portfolio_id: portfolioId === "none" ? null : portfolioId,
              start_date: startDate || null,
              end_date: endDate || null,
              baseline_end_date: baselineEnd || null,
              budget_planned: budget ? Number(budget) : null,
            })}
          >Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
