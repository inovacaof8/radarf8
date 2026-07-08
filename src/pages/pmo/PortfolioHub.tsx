import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/pmo/PageHeader";
import { StatusBadge, HealthBadge } from "@/components/pmo/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, Search, ChevronRight, ChevronDown, BarChart3, ExternalLink,
  Briefcase, FolderKanban, FileText, FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import ProjectPdfExport from "@/components/pmo/ProjectPdfExport";
import ProjectImportDialog from "@/components/pmo/ProjectImportDialog";
import PortfolioAreaPicker, { PortfolioAreaOption } from "@/components/pmo/PortfolioAreaPicker";

const STATUS_SIMPLE = [
  { v: "ativo", l: "Ativo" },
  { v: "pausado", l: "Pausado" },
  { v: "encerrado", l: "Encerrado" },
];
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

type Portfolio = { id: string; name: string; objective: string | null; status: string };
type Program = { id: string; name: string; benefits: string | null; status: string; portfolio_id: string; start_date: string | null; end_date: string | null };
type Project = {
  id: string; code: string | null; name: string; description: string | null;
  status: string; health: string; program_id: string | null; portfolio_id: string | null;
  start_date: string | null; end_date: string | null; baseline_end_date: string | null;
  budget_planned: number | null;
};

export default function PortfolioHub() {
  const { user, isAdmin, hasPermission, hasAnyRole } = useAuth();
  const canPortfolio = isAdmin
    || hasPermission("portfolio", "create") || hasPermission("portfolio", "edit")
    || hasPermission("portfolio", "delete") || hasPermission("portfolio", "admin");
  const canProgram = isAdmin
    || hasPermission("program", "create") || hasPermission("program", "edit")
    || hasPermission("program", "delete") || hasPermission("program", "admin");
  const canProject = isAdmin
    || hasPermission("project", "create") || hasPermission("project", "edit")
    || hasPermission("project", "delete") || hasPermission("project", "admin");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [deletingPortfolio, setDeletingPortfolio] = useState<Portfolio | null>(null);

  const [creatingProgramFor, setCreatingProgramFor] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<Program | null>(null);

  const [creatingProjectFor, setCreatingProjectFor] = useState<{ portfolioId: string; programId: string } | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [importingProject, setImportingProject] = useState(false);

  // Load everything once — RLS filters by user
  const portfolios = useQuery({
    queryKey: ["hub-portfolios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio").select("id, name, objective, status")
        .order("name");
      if (error) throw error;
      return (data || []) as Portfolio[];
    },
  });

  const programs = useQuery({
    queryKey: ["hub-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program").select("id, name, benefits, status, portfolio_id, start_date, end_date")
        .order("name");
      if (error) throw error;
      return (data || []) as Program[];
    },
  });

  const projects = useQuery({
    queryKey: ["hub-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project").select("id, code, name, description, status, health, program_id, portfolio_id, start_date, end_date, baseline_end_date, budget_planned, budget_spent")
        .order("name");
      if (error) throw error;
      return (data || []) as Project[];
    },
  });

  const manageableAreas = useQuery({
    queryKey: ["hub-portfolio-manageable-areas", user?.id, isAdmin, hasAnyRole("PMO")],
    enabled: !!user,
    queryFn: async () => {
      const { data: allAreas, error } = await supabase
        .from("area")
        .select("id, name, acronym")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      if (isAdmin || hasAnyRole("PMO")) return (allAreas || []) as PortfolioAreaOption[];

      const [{ data: managed }, { data: memberships }] = await Promise.all([
        supabase.rpc("user_managed_areas", { _user_id: user!.id }),
        supabase.from("user_area_membership").select("area_id").eq("user_id", user!.id).eq("status", "active"),
      ]);
      const allowed = new Set<string>();
      (managed || []).forEach((m: any) => allowed.add(m.area_id));
      if (hasAnyRole("Gestor")) (memberships || []).forEach((m: any) => allowed.add(m.area_id));
      return ((allAreas || []) as PortfolioAreaOption[]).filter((area) => allowed.has(area.id));
    },
  });

  const syncPortfolioAreas = async (portfolioId: string, areaIds: string[]) => {
    const { data: existing, error: readError } = await (supabase as any)
      .from("portfolio_area")
      .select("area_id")
      .eq("portfolio_id", portfolioId);
    if (readError) throw readError;

    const existingIds = new Set<string>((existing || []).map((row: any) => row.area_id));
    const nextIds = new Set(areaIds);
    const toRemove = Array.from(existingIds).filter((id) => !nextIds.has(id));
    const toAdd = areaIds.filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await (supabase as any)
        .from("portfolio_area")
        .delete()
        .eq("portfolio_id", portfolioId)
        .in("area_id", toRemove);
      if (error) throw error;
    }

    if (toAdd.length > 0) {
      const { error } = await (supabase as any).from("portfolio_area").insert(
        toAdd.map((areaId, index) => ({
          portfolio_id: portfolioId,
          area_id: areaId,
          is_primary: index === 0 && existingIds.size === 0,
        }))
      );
      if (error) throw error;
    }
  };

  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  // ============ Mutations ============
  const upsertPortfolio = useMutation({
    mutationFn: async (input: Partial<Portfolio> & { id?: string; area_ids?: string[] }) => {
      if (input.id) {
        const { error } = await supabase.from("portfolio").update({
          name: input.name, objective: input.objective, status: input.status,
        }).eq("id", input.id);
        if (error) throw error;
        await syncPortfolioAreas(input.id, input.area_ids || []);
      } else {
        const { data, error } = await supabase.from("portfolio").insert({
          name: input.name!, objective: input.objective ?? null, status: input.status ?? "ativo", owner_id: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        await syncPortfolioAreas(data.id, input.area_ids || []);
      }
    },
    onSuccess: () => {
      toast.success("Portfólio salvo");
      qc.invalidateQueries({ queryKey: ["hub-portfolios"] });
      setCreatingPortfolio(false); setEditingPortfolio(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removePortfolio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Portfólio removido");
      qc.invalidateQueries({ queryKey: ["hub-portfolios"] });
      setDeletingPortfolio(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const upsertProgram = useMutation({
    mutationFn: async (input: Partial<Program> & { id?: string; portfolio_id: string }) => {
      if (input.id) {
        const { error } = await supabase.from("program").update({
          name: input.name, benefits: input.benefits, status: input.status,
          start_date: input.start_date, end_date: input.end_date,
        }).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("program").insert({
          name: input.name!, benefits: input.benefits ?? null, status: input.status ?? "ativo",
          portfolio_id: input.portfolio_id,
          start_date: input.start_date ?? null, end_date: input.end_date ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Programa salvo");
      qc.invalidateQueries({ queryKey: ["hub-programs"] });
      setCreatingProgramFor(null); setEditingProgram(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programa removido");
      qc.invalidateQueries({ queryKey: ["hub-programs"] });
      setDeletingProgram(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const upsertProject = useMutation({
    mutationFn: async (input: Partial<Project> & { id?: string; portfolio_id: string; program_id: string }) => {
      const payload = {
        code: input.code || null, name: input.name, description: input.description ?? null,
        status: input.status ?? "iniciacao", health: input.health ?? "verde",
        program_id: input.program_id, portfolio_id: input.portfolio_id,
        start_date: input.start_date || null, end_date: input.end_date || null,
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
      qc.invalidateQueries({ queryKey: ["hub-projects"] });
      setCreatingProjectFor(null); setEditingProject(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto removido");
      qc.invalidateQueries({ queryKey: ["hub-projects"] });
      setDeletingProject(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  // ============ Filter (search expands matching branches) ============
  const q = search.trim().toLowerCase();
  const matchPortfolio = (p: Portfolio) => !q || p.name.toLowerCase().includes(q);
  const matchProgram = (p: Program) => !q || p.name.toLowerCase().includes(q);
  const matchProject = (p: Project) => !q || p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q);

  const visiblePortfolios = (portfolios.data || []).filter((pf) => {
    if (!q) return true;
    if (matchPortfolio(pf)) return true;
    const progs = (programs.data || []).filter(pr => pr.portfolio_id === pf.id);
    if (progs.some(matchProgram)) return true;
    const projs = (projects.data || []).filter(pj => pj.portfolio_id === pf.id);
    return projs.some(matchProject);
  });

  const isLoading = portfolios.isLoading || programs.isLoading || projects.isLoading;

  return (
    <div>
      <PageHeader
        title="Portfólios"
        description="Árvore de portfólios, programas e projetos."
        actions={canPortfolio && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportingProject(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar projeto (planilha)
            </Button>
            <Button onClick={() => setCreatingPortfolio(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
              <Plus className="h-4 w-4 mr-1" /> Novo portfólio
            </Button>
          </div>
        )}
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar portfólio, programa ou projeto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2">
          {isLoading ? (
            <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : visiblePortfolios.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum portfólio.
            </div>
          ) : (
            <div className="divide-y">
              {visiblePortfolios.map((pf) => {
                const pfKey = `pf:${pf.id}`;
                const open = !!expanded[pfKey] || !!q;
                const progs = (programs.data || []).filter(pr => pr.portfolio_id === pf.id && (!q || matchProgram(pr) || (projects.data || []).some(pj => pj.program_id === pr.id && matchProject(pj))));
                return (
                  <div key={pf.id}>
                    {/* Portfolio row */}
                    <div className="flex items-center gap-2 px-2 py-2 hover:bg-muted/40 rounded">
                      <button onClick={() => toggle(pfKey)} className="p-1 hover:bg-muted rounded shrink-0">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <Briefcase className="h-4 w-4 text-brand-500 shrink-0" />
                      <button onClick={() => toggle(pfKey)} className="flex-1 text-left font-semibold truncate">
                        {pf.name}
                      </button>
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        {progs.length} {progs.length === 1 ? "programa" : "programas"}
                      </span>
                      <StatusBadge status={pf.status} kind="simple" />
                      {canPortfolio && (
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" title="Novo programa" onClick={() => { setCreatingProgramFor(pf.id); setExpanded(s => ({ ...s, [pfKey]: true })); }}>
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingPortfolio(pf)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingPortfolio(pf)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </div>

                    {/* Programs */}
                    {open && (
                      <div className="ml-6 border-l pl-2 my-1">
                        {progs.length === 0 ? (
                          <div className="px-2 py-2 text-xs italic text-muted-foreground">Nenhum programa.</div>
                        ) : progs.map((pr) => {
                          const prKey = `pr:${pr.id}`;
                          const popen = !!expanded[prKey] || !!q;
                          const projs = (projects.data || []).filter(pj => pj.program_id === pr.id && (!q || matchProject(pj) || matchProgram(pr)));
                          return (
                            <div key={pr.id}>
                              <div className="flex items-center gap-2 px-2 py-2 hover:bg-muted/40 rounded">
                                <button onClick={() => toggle(prKey)} className="p-1 hover:bg-muted rounded shrink-0">
                                  {popen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <FolderKanban className="h-4 w-4 text-brand-500 shrink-0" />
                                <button onClick={() => toggle(prKey)} className="flex-1 text-left font-medium truncate">
                                  {pr.name}
                                </button>
                                <span className="text-xs text-muted-foreground hidden md:inline">
                                  {projs.length} {projs.length === 1 ? "projeto" : "projetos"}
                                </span>
                                <StatusBadge status={pr.status} kind="simple" />
                                <Button asChild variant="ghost" size="icon" title="Dashboard">
                                  <Link to={`/programas/${pr.id}/dashboard`}><BarChart3 className="h-4 w-4" /></Link>
                                </Button>
                                {canProgram && (
                                  <div className="flex items-center gap-0.5">
                                    <Button variant="ghost" size="icon" title="Novo projeto" onClick={() => { setCreatingProjectFor({ portfolioId: pf.id, programId: pr.id }); setExpanded(s => ({ ...s, [prKey]: true })); }}>
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setEditingProgram(pr)}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeletingProgram(pr)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </div>
                                )}
                              </div>

                              {/* Projects */}
                              {popen && (
                                <div className="ml-6 border-l pl-2 my-1">
                                  {projs.length === 0 ? (
                                    <div className="px-2 py-2 text-xs italic text-muted-foreground">Nenhum projeto.</div>
                                  ) : projs.map((pj) => (
                                    <div key={pj.id} className="flex items-center gap-2 px-2 py-2 hover:bg-muted/40 rounded">
                                      <FileText className="h-4 w-4 text-brand-500 shrink-0 ml-6" />
                                      <Link to={`/projetos/${pj.id}`} className="flex-1 min-w-0 truncate hover:underline">
                                        {pj.code && <span className="font-mono text-xs text-muted-foreground mr-2">{pj.code}</span>}
                                        {pj.name}
                                      </Link>
                                      <StatusBadge status={pj.status} />
                                      <HealthBadge h={pj.health} />
                                      <span className="text-xs text-muted-foreground hidden lg:inline">
                                        {pj.end_date ? new Date(pj.end_date).toLocaleDateString("pt-BR") : "—"}
                                      </span>
                                      <ProjectPdfExport projectId={pj.id} projectName={pj.name} projectCode={pj.code} />
                                      <Link to={`/projetos/${pj.id}`}>
                                        <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                                      </Link>
                                      {canProject && (
                                        <>
                                          <Button variant="ghost" size="icon" onClick={() => setEditingProject(pj)}><Pencil className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" onClick={() => setDeletingProject(pj)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ Portfolio Sheet ============ */}
      <PortfolioSheet
        open={creatingPortfolio || !!editingPortfolio}
        portfolio={editingPortfolio}
        areas={manageableAreas.data || []}
        areasLoading={manageableAreas.isLoading}
        onClose={() => { setCreatingPortfolio(false); setEditingPortfolio(null); }}
        onSave={(p) => upsertPortfolio.mutate(p)}
        saving={upsertPortfolio.isPending}
      />

      <AlertDialog open={!!deletingPortfolio} onOpenChange={(o) => !o && setDeletingPortfolio(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover portfólio?</AlertDialogTitle>
            <AlertDialogDescription>"{deletingPortfolio?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingPortfolio && removePortfolio.mutate(deletingPortfolio.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ Program Sheet ============ */}
      <ProgramSheet
        open={!!creatingProgramFor || !!editingProgram}
        program={editingProgram}
        onClose={() => { setCreatingProgramFor(null); setEditingProgram(null); }}
        onSave={(p) => upsertProgram.mutate({ ...p, portfolio_id: editingProgram?.portfolio_id || creatingProgramFor! })}
        saving={upsertProgram.isPending}
      />

      <AlertDialog open={!!deletingProgram} onOpenChange={(o) => !o && setDeletingProgram(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover programa?</AlertDialogTitle>
            <AlertDialogDescription>"{deletingProgram?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingProgram && removeProgram.mutate(deletingProgram.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ Project Sheet ============ */}
      <ProjectSheet
        open={!!creatingProjectFor || !!editingProject}
        project={editingProject}
        onClose={() => { setCreatingProjectFor(null); setEditingProject(null); }}
        onSave={(p) => upsertProject.mutate({
          ...p,
          portfolio_id: editingProject?.portfolio_id || creatingProjectFor!.portfolioId,
          program_id: editingProject?.program_id || creatingProjectFor!.programId,
        })}
        onImport={() => { setImportingProject(true); }}
        saving={upsertProject.isPending}
      />

      <AlertDialog open={!!deletingProject} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover projeto?</AlertDialogTitle>
            <AlertDialogDescription>"{deletingProject?.name}" e dados vinculados serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingProject && removeProject.mutate(deletingProject.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectImportDialog
        open={importingProject}
        onOpenChange={setImportingProject}
      />
    </div>
  );
}

/* ============ SHEETS ============ */

function PortfolioSheet({ open, portfolio, areas, areasLoading, onClose, onSave, saving }: {
  open: boolean; portfolio: Portfolio | null;
  areas: PortfolioAreaOption[]; areasLoading: boolean;
  onClose: () => void; onSave: (p: Partial<Portfolio> & { id?: string; area_ids?: string[] }) => void; saving: boolean;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [status, setStatus] = useState("ativo");
  const [areaIds, setAreaIds] = useState<string[]>([]);

  const portfolioAreas = useQuery({
    queryKey: ["hub-portfolio-areas", portfolio?.id],
    enabled: open && !!portfolio?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("portfolio_area")
        .select("area_id")
        .eq("portfolio_id", portfolio!.id);
      if (error) throw error;
      return (data || []).map((row: any) => row.area_id) as string[];
    },
  });

  useEffect(() => {
    if (open) {
      setName(portfolio?.name ?? "");
      setObjective(portfolio?.objective ?? "");
      setStatus(portfolio?.status ?? "ativo");
      setAreaIds([]);
    }
  }, [open, portfolio]);

  useEffect(() => {
    if (!open) return;
    if (portfolio?.id) setAreaIds(portfolioAreas.data || []);
  }, [open, portfolio?.id, portfolioAreas.data]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader><SheetTitle>{portfolio ? "Editar portfólio" : "Novo portfólio"}</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Objetivo</Label><Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={4} /></div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_SIMPLE.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <PortfolioAreaPicker
            areas={areas}
            value={areaIds}
            onChange={setAreaIds}
            loading={areasLoading || portfolioAreas.isLoading}
            disabled={saving}
          />
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving || portfolioAreas.isLoading} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({ id: portfolio?.id, name: name.trim(), objective: objective.trim() || null, status, area_ids: areaIds })}>
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProgramSheet({ open, program, onClose, onSave, saving }: {
  open: boolean; program: Program | null;
  onClose: () => void; onSave: (p: Partial<Program> & { id?: string }) => void; saving: boolean;
}) {
  const [name, setName] = useState("");
  const [benefits, setBenefits] = useState("");
  const [status, setStatus] = useState("ativo");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setBenefits(program?.benefits ?? "");
      setStatus(program?.status ?? "ativo");
      setStartDate(program?.start_date ?? "");
      setEndDate(program?.end_date ?? "");
    }
  }, [open, program]);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{program ? "Editar programa" : "Novo programa"}</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Benefícios esperados</Label><Textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_SIMPLE.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({
              id: program?.id, name: name.trim(), benefits: benefits.trim() || null, status,
              start_date: startDate || null, end_date: endDate || null,
            })}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProjectSheet({ open, project, onClose, onSave, onImport, saving }: {
  open: boolean; project: Project | null;
  onClose: () => void; onSave: (p: Partial<Project> & { id?: string }) => void;
  onImport?: () => void; saving: boolean;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("iniciacao");
  const [health, setHealth] = useState("verde");
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
      setStartDate(project?.start_date ?? "");
      setEndDate(project?.end_date ?? "");
      setBaselineEnd(project?.baseline_end_date ?? "");
      setBudget(project?.budget_planned?.toString() ?? "");
    }
  }, [open, project]);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{project ? "Editar projeto" : "Novo projeto"}</SheetTitle></SheetHeader>
        {!project && onImport && (
          <div className="pt-3">
            <Button variant="outline" size="sm" onClick={() => { onImport(); onClose(); }}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Importar de planilha
            </Button>
          </div>
        )}
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-2 col-span-2"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saúde</Label>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HEALTH_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Baseline fim</Label><Input type="date" value={baselineEnd} onChange={(e) => setBaselineEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Orçamento planejado (R$)</Label><Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({
              id: project?.id, code: code.trim() || null, name: name.trim(),
              description: description.trim() || null, status, health,
              start_date: startDate || null, end_date: endDate || null,
              baseline_end_date: baselineEnd || null,
              budget_planned: budget ? Number(budget) : null,
            })}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
