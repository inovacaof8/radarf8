import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, HealthBadge } from "@/components/pmo/StatusBadge";
import ProjectSchedule from "@/components/pmo/ProjectSchedule";
import Documents from "@/components/pmo/Documents";
import ProjectPdfExport from "@/components/pmo/ProjectPdfExport";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Calendar, DollarSign, TrendingUp, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user, hasAnyRole, hasPermission } = useAuth();
  const isPMO = hasAnyRole("PMO");
  const isAdminOrPMO = isAdmin || isPMO
    || hasPermission("project", "edit")
    || hasPermission("project", "admin");
  const qc = useQueryClient();
  const [changingLeader, setChangingLeader] = useState(false);

  const project = useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project")
        .select("*, program:program_id(name), portfolio:portfolio_id(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tasksProgress = useQuery({
    queryKey: ["project-progress", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("task").select("progress").eq("project_id", id!);
      const list = data || [];
      if (!list.length) return 0;
      return Math.round(list.reduce((s, t) => s + (t.progress || 0), 0) / list.length);
    },
  });

  if (project.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!project.data) return (
    <div className="text-center py-12 text-muted-foreground">
      <p>Projeto não encontrado.</p>
      <Link to="/projetos" className="text-primary underline mt-2 inline-block">Voltar para projetos</Link>
    </div>
  );

  const p = project.data;
  const daysToDeadline = p.end_date
    ? Math.ceil((new Date(p.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const budgetPct = p.budget_planned ? Math.round(((p.budget_spent || 0) / Number(p.budget_planned)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projetos" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4 mr-1" /> Projetos
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            {p.code && <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{p.code}</p>}
            <h1 className="text-3xl font-extrabold tracking-tight">{p.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={p.status} />
              <HealthBadge h={p.health} />
              {p.program?.name && <Badge variant="outline">{p.program.name}</Badge>}
              {p.portfolio?.name && <Badge variant="outline">{p.portfolio.name}</Badge>}
            </div>
          </div>
          <ProjectPdfExport projectId={p.id} projectName={p.name} projectCode={p.code} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Progresso</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="f8-stat mt-2">{tasksProgress.data ?? 0}%</p>
            <Progress value={tasksProgress.data ?? 0} className="mt-3 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Prazo</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="f8-stat mt-2">
              {daysToDeadline === null ? "—" : daysToDeadline < 0 ? `${Math.abs(daysToDeadline)}d` : `${daysToDeadline}d`}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {daysToDeadline === null ? "Sem fim definido" : daysToDeadline < 0 ? "atrasado" : "até o fim"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Orçamento</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="f8-stat mt-2">{budgetPct}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              R$ {Number(p.budget_spent || 0).toLocaleString("pt-BR")} / R$ {Number(p.budget_planned || 0).toLocaleString("pt-BR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cronograma">
        <TabsList>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="riscos">Riscos</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="cronograma" className="pt-4">
          <ProjectSchedule
            projectId={p.id}
            canManage={isAdminOrPMO || p.manager_id === user?.id}
            currentUserId={user?.id || null}
          />
        </TabsContent>

        <TabsContent value="visao" className="space-y-4 pt-4">
          <LeaderCard
            projectId={p.id}
            managerId={p.manager_id}
            canChange={isAdminOrPMO}
            onChange={() => setChangingLeader(true)}
          />
          <OverviewEditor project={p} canEdit={isAdminOrPMO || p.manager_id === user?.id} />
        </TabsContent>

        <TabsContent value="documentos" className="pt-4">
          <Documents projectId={p.id} />
        </TabsContent>

        <TabsContent value="riscos" className="pt-4">
          <RisksTab projectId={p.id} canManage={true} />
        </TabsContent>

        <TabsContent value="equipe" className="pt-4">
          <TeamTab projectId={p.id} canManage={isAdminOrPMO || p.manager_id === user?.id} managerId={p.manager_id} />
        </TabsContent>
      </Tabs>

      <ChangeLeaderDialog
        open={changingLeader}
        projectId={p.id}
        currentManagerId={p.manager_id}
        onClose={() => setChangingLeader(false)}
      />
    </div>
  );
}

// ============== LEADER CARD ==============
function LeaderCard({
  projectId, managerId, canChange, onChange,
}: { projectId: string; managerId: string | null; canChange: boolean; onChange: () => void }) {
  const leader = useQuery({
    queryKey: ["project-leader", projectId, managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("user_id, name, email")
        .eq("user_id", managerId!).maybeSingle();
      return data;
    },
  });
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Líder do projeto</span>
          {!managerId ? (
            <p className="text-sm italic text-muted-foreground mt-1">Líder não definido</p>
          ) : leader.isLoading ? (
            <Skeleton className="h-5 w-40 mt-2" />
          ) : (
            <div className="mt-1">
              <p className="font-bold text-base">{leader.data?.name || "—"}</p>
              <p className="text-xs text-muted-foreground">{leader.data?.email || "—"}</p>
            </div>
          )}
        </div>
        {canChange && (
          <Button size="sm" variant="outline" onClick={onChange}>Alterar líder</Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============== CHANGE LEADER DIALOG ==============
function ChangeLeaderDialog({
  open, projectId, currentManagerId, onClose,
}: { open: boolean; projectId: string; currentManagerId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(currentManagerId || "");

  const profs = useSelectableUsers({ enabled: open });

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um usuário");
      const { error } = await supabase.from("project").update({ manager_id: selected }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Líder atualizado");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-leader", projectId] });
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      qc.invalidateQueries({ queryKey: ["sched-members", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao alterar líder"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Alterar líder do projeto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(profs.data || []).map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name} — {p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            O usuário selecionado será adicionado automaticamente como membro do projeto com o papel "líder do projeto".
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            disabled={!selected || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== EQUIPE ==============
function TeamTab({ projectId, canManage, managerId }: { projectId: string; canManage: boolean; managerId: string | null }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [roleInProject, setRoleInProject] = useState("membro");

  const members = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_member")
        .select("user_id, role_in_project, created_at")
        .eq("project_id", projectId);
      const ids = (data || []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids);
      return (data || []).map((m) => ({
        ...m,
        profile: profs?.find((p) => p.user_id === m.user_id) ?? null,
      }));
    },
  });

  const profiles = useSelectableUsers({ enabled: adding });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_member").insert({
        project_id: projectId,
        user_id: selectedUser,
        role_in_project: roleInProject,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      qc.invalidateQueries({ queryKey: ["project-members"] });
      setAdding(false); setSelectedUser(""); setRoleInProject("membro");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar"),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("project_member").delete()
        .eq("project_id", projectId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["project-members"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Membros do projeto</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {members.isLoading ? (
          <div className="p-4"><Skeleton className="h-10" /></div>
        ) : !members.data?.length ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Sem membros ainda.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>E-mail</TableHead>
              <TableHead>Papel no projeto</TableHead><TableHead className="w-[60px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {members.data.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">
                    {m.profile?.name || m.user_id.slice(0, 8)}
                    {m.user_id === managerId && <Badge className="ml-2 bg-brand-500 text-ink text-[9px] uppercase">Gerente</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.profile?.email || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{m.role_in_project}</Badge></TableCell>
                  <TableCell>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.user_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar membro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(profiles.data || []).map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name} — {p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Papel no projeto</Label>
              <Input value={roleInProject} onChange={(e) => setRoleInProject(e.target.value)} placeholder="membro, líder técnico..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              disabled={!selectedUser || addMember.isPending}
              onClick={() => addMember.mutate()}
            >Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============== RISCOS ==============
function RisksTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [probability, setProbability] = useState("3");
  const [impact, setImpact] = useState("3");
  const [response, setResponse] = useState("");

  const risks = useQuery({
    queryKey: ["project-risks", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk")
        .select("id, description, probability, impact, exposure, response, status, created_at")
        .eq("project_id", projectId)
        .order("exposure", { ascending: false, nullsFirst: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("risk").insert({
        project_id: projectId,
        description,
        probability: Number(probability),
        impact: Number(impact),
        response: response || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco registrado");
      qc.invalidateQueries({ queryKey: ["project-risks"] });
      setAdding(false); setDescription(""); setProbability("3"); setImpact("3"); setResponse("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("risk").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco removido");
      qc.invalidateQueries({ queryKey: ["project-risks"] });
    },
  });

  const expColor = (exp: number | null) => {
    if (!exp) return "bg-secondary";
    if (exp >= 15) return "bg-destructive text-destructive-foreground";
    if (exp >= 8) return "bg-warning text-warning-foreground";
    return "bg-success text-success-foreground";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Riscos
        </CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {risks.isLoading ? <div className="p-4"><Skeleton className="h-10" /></div> :
        !risks.data?.length ? <p className="p-6 text-sm text-muted-foreground text-center">Sem riscos registrados.</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Descrição</TableHead><TableHead>Prob.</TableHead><TableHead>Imp.</TableHead>
              <TableHead>Exposição</TableHead><TableHead>Resposta</TableHead><TableHead className="w-[60px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {risks.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm max-w-md">{r.description}</TableCell>
                  <TableCell>{r.probability ?? "—"}</TableCell>
                  <TableCell>{r.impact ?? "—"}</TableCell>
                  <TableCell><Badge className={expColor(r.exposure)}>{r.exposure ?? "—"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.response || "—"}</TableCell>
                  <TableCell>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo risco</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Probabilidade (1-5)</Label>
                <Input type="number" min={1} max={5} value={probability} onChange={(e) => setProbability(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Impacto (1-5)</Label>
                <Input type="number" min={1} max={5} value={impact} onChange={(e) => setImpact(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Resposta planejada</Label>
              <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              disabled={!description.trim() || create.isPending}
              onClick={() => create.mutate()}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============== OVERVIEW EDITOR ==============
function OverviewEditor({ project, canEdit }: { project: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: project.name || "",
    code: project.code || "",
    description: project.description || "",
    status: project.status || "iniciacao",
    health: project.health || "verde",
    start_date: project.start_date || "",
    end_date: project.end_date || "",
    baseline_end_date: project.baseline_end_date || "",
    budget_planned: project.budget_planned ?? "",
    budget_spent: project.budget_spent ?? 0,
    program_id: project.program_id || "",
    portfolio_id: project.portfolio_id || "",
  });

  const portfolios = useQuery({
    queryKey: ["all-portfolios"],
    enabled: editing,
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name").order("name");
      return data || [];
    },
  });
  const programs = useQuery({
    queryKey: ["all-programs", form.portfolio_id],
    enabled: editing,
    queryFn: async () => {
      let q = supabase.from("program").select("id, name, portfolio_id").order("name");
      if (form.portfolio_id) q = q.eq("portfolio_id", form.portfolio_id);
      const { data } = await q;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        status: form.status,
        health: form.health,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        baseline_end_date: form.baseline_end_date || null,
        budget_planned: form.budget_planned === "" ? null : Number(form.budget_planned),
        budget_spent: Number(form.budget_spent) || 0,
        program_id: form.program_id || null,
        portfolio_id: form.portfolio_id || null,
      };
      const { error } = await supabase.from("project").update(payload).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto atualizado");
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (!editing) {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Descrição</CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar projeto</Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">
              {project.description || <span className="text-muted-foreground italic">Sem descrição</span>}
            </p>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 text-sm space-y-2">
              <div><span className="text-muted-foreground">Início:</span> {project.start_date ? new Date(project.start_date).toLocaleDateString("pt-BR") : "—"}</div>
              <div><span className="text-muted-foreground">Fim:</span> {project.end_date ? new Date(project.end_date).toLocaleDateString("pt-BR") : "—"}</div>
              <div><span className="text-muted-foreground">Baseline fim:</span> {project.baseline_end_date ? new Date(project.baseline_end_date).toLocaleDateString("pt-BR") : "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 text-sm space-y-2">
              <div><span className="text-muted-foreground">Programa:</span> {project.program?.name || "—"}</div>
              <div><span className="text-muted-foreground">Portfolio:</span> {project.portfolio?.name || "—"}</div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Editar projeto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2 col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciacao">Iniciação</SelectItem>
                <SelectItem value="planejamento">Planejamento</SelectItem>
                <SelectItem value="execucao">Execução</SelectItem>
                <SelectItem value="monitoramento">Monitoramento</SelectItem>
                <SelectItem value="encerramento">Encerramento</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Saúde</Label>
            <Select value={form.health} onValueChange={(v) => setForm({ ...form, health: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verde">Saudável</SelectItem>
                <SelectItem value="amarelo">Atenção</SelectItem>
                <SelectItem value="vermelho">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Portfolio</Label>
            <Select value={form.portfolio_id} onValueChange={(v) => setForm({ ...form, portfolio_id: v, program_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(portfolios.data || []).map((pf) => (
                  <SelectItem key={pf.id} value={pf.id}>{pf.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Programa</Label>
            <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(programs.data || []).map((pg) => (
                  <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Baseline fim</Label>
            <Input type="date" value={form.baseline_end_date || ""} onChange={(e) => setForm({ ...form, baseline_end_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Orçamento planejado</Label>
            <Input type="number" step="0.01" value={form.budget_planned} onChange={(e) => setForm({ ...form, budget_planned: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Orçamento gasto</Label>
            <Input type="number" step="0.01" value={form.budget_spent} onChange={(e) => setForm({ ...form, budget_spent: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          <Button
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            disabled={!form.name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
