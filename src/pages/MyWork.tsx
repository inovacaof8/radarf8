import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, AlertCircle, Calendar, CheckCircle2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TeamFiltersBar, EMPTY_FILTERS, type TeamFiltersValue } from "@/components/filters/TeamFiltersBar";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { useTeamFilterOptions } from "@/hooks/useTeamFilterOptions";

type Task = {
  id: string;
  name: string;
  end_date: string | null;
  priority: string;
  status: string;
  project_id: string;
  project?: { name: string; code: string | null } | null;
};

type ProjectCard = {
  id: string;
  name: string;
  code: string | null;
  health: string;
  end_date: string | null;
};

type Approval = {
  id: string;
  decided_at: string | null;
  decision: string;
  comment: string | null;
  created_at: string;
  version: {
    id: string;
    version_no: number;
    uploaded_by: string | null;
    document: {
      id: string;
      title: string;
      project_id: string | null;
      project: { name: string } | null;
    } | null;
  } | null;
  submitter?: { name: string } | null;
};

const localISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => localISO(new Date());
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localISO(d);
};

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critica: { label: "Crítica", cls: "bg-destructive text-destructive-foreground" },
    alta: { label: "Alta", cls: "bg-warning text-warning-foreground" },
    media: { label: "Média", cls: "bg-muted text-muted-foreground" },
    baixa: { label: "Baixa", cls: "bg-secondary text-secondary-foreground" },
  };
  const m = map[p] ?? map.media;
  return <Badge className={`${m.cls} text-[10px] uppercase tracking-wider`}>{m.label}</Badge>;
}

function HealthBadge({ h }: { h: string }) {
  const cls = h === "vermelho" ? "health-vermelho" : h === "amarelo" ? "health-amarelo" : "health-verde";
  return <span className={`${cls} px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider`}>{h}</span>;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <span className="text-xs font-mono text-muted-foreground">{count}</span>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-brand-500 transition-colors">
      <Checkbox onCheckedChange={() => onToggle(task.id)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{task.name}</p>
        {task.project && (
          <Link to={`/projetos/${task.project_id}`} className="text-xs text-muted-foreground hover:text-foreground">
            {task.project.code ? `${task.project.code} · ` : ""}{task.project.name}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.end_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(task.end_date).toLocaleDateString("pt-BR")}
          </span>
        )}
        <PriorityBadge p={task.priority} />
      </div>
    </div>
  );
}

export default function MyWork() {
  const { user, profile, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  // Filtros globais da página
  const [teamFilters, setTeamFilters] = usePersistedFilters<TeamFiltersValue>("mywork-team", EMPTY_FILTERS);
  const { people: teamPeople } = useTeamFilterOptions();
  const canSeeTeam = hasAnyRole("Administrador", "PMO", "Gestor", "Diretor Geral");

  // Gestores/PMO/Diretor Geral veem o escopo top-down por padrão; filtro de pessoa restringe a visão.
  const targetUserIds = useMemo(() => {
    if (teamFilters.personIds.length) return teamFilters.personIds;
    if (canSeeTeam && teamPeople.length) return teamPeople.map((p) => p.user_id);
    return userId ? [userId] : [];
  }, [teamFilters.personIds, canSeeTeam, teamPeople, userId]);
  const targetKey = targetUserIds.join(",");
  const isImpersonating = teamFilters.personIds.length > 0;


  // ===== Tarefas =====
  const tasksQuery = useQuery({
    queryKey: ["mywork-tasks", targetKey],
    enabled: targetUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task")
        .select("id, name, end_date, priority, status, project_id, project:project_id(name, code)")
        .in("assignee_id", targetUserIds)
        .in("status", ["backlog", "em_andamento", "bloqueada"])
        .order("end_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as Task[];
    },
  });

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("task")
        .update({ status: "concluida", progress: 100 })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa concluída!");
      qc.invalidateQueries({ queryKey: ["mywork-tasks"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao concluir tarefa"),
  });

  const { atrasadas, hoje, semana } = useMemo(() => {
    const today = todayISO();
    const week = inDays(7);
    const t = (tasksQuery.data || []).filter((x) => {
      if (teamFilters.statuses.length && !teamFilters.statuses.includes(x.status)) return false;
      if (teamFilters.priorities.length && !teamFilters.priorities.includes(x.priority)) return false;
      if (teamFilters.period.from && (!x.end_date || x.end_date < teamFilters.period.from)) return false;
      if (teamFilters.period.to && (!x.end_date || x.end_date > teamFilters.period.to)) return false;
      return true;
    });
    return {
      atrasadas: t.filter((x) => x.end_date && x.end_date < today),
      hoje: t.filter((x) => x.end_date === today),
      semana: t.filter((x) => x.end_date && x.end_date > today && x.end_date <= week),
    };
  }, [tasksQuery.data, teamFilters]);

  // ===== Projetos =====
  const projectsQuery = useQuery({
    queryKey: ["mywork-projects", targetKey],
    enabled: targetUserIds.length > 0,
    queryFn: async () => {
      const { data: managed } = await supabase
        .from("project")
        .select("id, name, code, health, end_date, manager_id")
        .in("manager_id", targetUserIds);
      const { data: memberships } = await supabase
        .from("project_member")
        .select("project_id")
        .in("user_id", targetUserIds);
      const memberIds = (memberships || []).map((m) => m.project_id);
      let memberProjects: ProjectCard[] = [];
      if (memberIds.length) {
        const { data } = await supabase
          .from("project")
          .select("id, name, code, health, end_date, manager_id")
          .in("id", memberIds);
        memberProjects = (data || []) as ProjectCard[];
      }
      const all = [...(managed || []), ...memberProjects] as ProjectCard[];
      const seen = new Set<string>();
      return all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    },
  });

  // ===== Aprovações =====
  const approvalsQuery = useQuery({
    queryKey: ["mywork-approvals", targetKey],
    enabled: targetUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_approval")
        .select(`
          id, decided_at, decision, comment, created_at,
          version:version_id (
            id, version_no, uploaded_by,
            document:document_id ( id, title, project_id, project:project_id(name) )
          )
        `)
        .in("approver_id", targetUserIds)
        .eq("decision", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Approval[];
    },
  });

  // ===== Pendências dos liderados (reuniões que gerencio) =====
  const managedQuery = useQuery({
    queryKey: ["mywork-managed-actions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_managed_action_items", {
        _manager_id: userId,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        meeting_id: string;
        meeting_title: string;
        title: string;
        description: string | null;
        assignee_id: string;
        assignee_name: string | null;
        assignee_email: string | null;
        due_date: string | null;
        priority: string;
        status: string;
        updated_at: string;
      }>;
    },
  });


  const managedBuckets = useMemo(() => {
    const today = todayISO();
    const recent = new Date();
    recent.setDate(recent.getDate() - 7);
    const recentISO = recent.toISOString().slice(0, 10);

    const personArea = new Map<string, string | null>(
      teamPeople.map((p) => [p.user_id, p.primary_area_id]),
    );

    const match = (x: any) => {
      if (teamFilters.personIds.length && (!x.assignee_id || !teamFilters.personIds.includes(x.assignee_id))) return false;
      if (teamFilters.areaIds.length) {
        const aid = x.assignee_id ? personArea.get(x.assignee_id) ?? null : null;
        if (!aid || !teamFilters.areaIds.includes(aid)) return false;
      }
      if (teamFilters.statuses.length && !teamFilters.statuses.includes(x.status)) return false;
      if (teamFilters.priorities.length && !teamFilters.priorities.includes(x.priority)) return false;
      if (teamFilters.period.from && (!x.due_date || x.due_date < teamFilters.period.from)) return false;
      if (teamFilters.period.to && (!x.due_date || x.due_date > teamFilters.period.to)) return false;
      return true;
    };

    const all = (managedQuery.data || []).filter(match);
    const open = all.filter((x) => x.status === "pendente" || x.status === "em_andamento");
    return {
      atrasadas: open.filter((x) => x.due_date && x.due_date < today),
      abertas: open.filter((x) => !x.due_date || x.due_date >= today),
      concluidas: all.filter(
        (x) => x.status === "concluida" && x.updated_at && x.updated_at.slice(0, 10) >= recentISO,
      ),
    };
  }, [managedQuery.data, teamFilters, teamPeople]);

  // ===== Reuniões agendadas =====
  const meetingsQuery = useQuery({
    queryKey: ["mywork-meetings", targetKey],
    enabled: targetUserIds.length > 0,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sinceISO = today.toISOString();

      const ids = targetUserIds;
      const orExpr = ids
        .flatMap((id) => [`created_by.eq.${id}`, `organizer_id.eq.${id}`, `manager_id.eq.${id}`])
        .join(",");
      const { data: owned, error: e1 } = await supabase
        .from("meeting")
        .select("id, title, scheduled_at, modality, location, status, created_by, organizer_id, manager_id")
        .eq("status", "agendada")
        .gte("scheduled_at", sinceISO)
        .or(orExpr);
      if (e1) throw e1;

      const { data: parts, error: e2 } = await supabase
        .from("meeting_participant")
        .select("meeting:meeting_id(id, title, scheduled_at, modality, location, status, created_by, organizer_id, manager_id)")
        .in("user_id", ids);
      if (e2) throw e2;
      const partMeetings = (parts || [])
        .map((p: any) => p.meeting)
        .filter((m: any) => m && m.status === "agendada" && m.scheduled_at >= sinceISO);

      const all = [...(owned || []), ...partMeetings];
      const seen = new Set<string>();
      return all
        .filter((m: any) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
        .sort((a: any, b: any) => a.scheduled_at.localeCompare(b.scheduled_at));
    },
  });


  // Modal de decisão
  const [decisionModal, setDecisionModal] = useState<{ id: string; kind: "aprovado" | "rejeitado" } | null>(null);
  const [comment, setComment] = useState("");

  const decideApproval = useMutation({
    mutationFn: async ({ id, kind, comment }: { id: string; kind: "aprovado" | "rejeitado"; comment: string }) => {
      const { error } = await supabase
        .from("document_approval")
        .update({ decision: kind, comment, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.kind === "aprovado" ? "Documento aprovado" : "Documento rejeitado");
      qc.invalidateQueries({ queryKey: ["mywork-approvals"] });
      setDecisionModal(null);
      setComment("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar decisão"),
  });

  // Helpers de filtro
  const personArea = useMemo(
    () => new Map(teamPeople.map((p) => [p.user_id, p.primary_area_id])),
    [teamPeople],
  );

  const dateInPeriod = (iso: string | null | undefined) => {
    if (!iso) return !teamFilters.period.from && !teamFilters.period.to;
    const d = iso.slice(0, 10);
    if (teamFilters.period.from && d < teamFilters.period.from) return false;
    if (teamFilters.period.to && d > teamFilters.period.to) return false;
    return true;
  };

  const fTasks = useMemo(() => {
    const ts = tasksQuery.data || [];
    return ts.filter((t) => {
      if (teamFilters.statuses.length && !teamFilters.statuses.includes(t.status)) return false;
      if (teamFilters.priorities.length && !teamFilters.priorities.includes(t.priority)) return false;
      if (!dateInPeriod(t.end_date)) return false;
      return true;
    });
  }, [tasksQuery.data, teamFilters]);

  const fProjects = useMemo(() => {
    const ps = projectsQuery.data || [];
    return ps.filter((p: any) => {
      if (teamFilters.personIds.length && (!p.manager_id || !teamFilters.personIds.includes(p.manager_id))) {
        // mantém se eu sou membro mas não gestor? aqui só filtra por pessoa quando há manager_id
        if (!p.manager_id || !teamFilters.personIds.includes(p.manager_id)) return false;
      }
      if (teamFilters.areaIds.length) {
        const aid = p.manager_id ? personArea.get(p.manager_id) ?? null : null;
        if (!aid || !teamFilters.areaIds.includes(aid)) return false;
      }
      if (teamFilters.statuses.length && p.status && !teamFilters.statuses.includes(p.status)) return false;
      if (!dateInPeriod(p.end_date)) return false;
      return true;
    });
  }, [projectsQuery.data, teamFilters, personArea]);

  const fMeetings = useMemo(() => {
    const ms = (meetingsQuery.data || []) as any[];
    return ms.filter((m) => {
      if (teamFilters.personIds.length) {
        const hit = [m.manager_id, m.organizer_id, m.created_by].some((id) => id && teamFilters.personIds.includes(id));
        if (!hit) return false;
      }
      if (teamFilters.areaIds.length) {
        const aid = m.manager_id ? personArea.get(m.manager_id) ?? null : null;
        if (!aid || !teamFilters.areaIds.includes(aid)) return false;
      }
      if (teamFilters.statuses.length && !teamFilters.statuses.includes(m.status)) return false;
      if (!dateInPeriod(m.scheduled_at)) return false;
      return true;
    });
  }, [meetingsQuery.data, teamFilters, personArea]);

  const fApprovals = useMemo(() => {
    const aps = approvalsQuery.data || [];
    return aps.filter((a) => dateInPeriod(a.created_at));
  }, [approvalsQuery.data, teamFilters]);

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Meu trabalho</h1>
        <p className="text-muted-foreground mt-1">
          {isImpersonating
            ? `Visualizando ${teamFilters.personIds.length === 1 ? "a pessoa selecionada" : `${teamFilters.personIds.length} pessoas`}. Limpe o filtro de pessoa para voltar à visão do seu escopo.`
            : canSeeTeam
              ? `Olá${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}. Aqui está o trabalho visível no seu escopo hierárquico.`
              : `Olá${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}. Aqui está tudo que precisa da sua atenção.`}
        </p>
      </header>

      <Card>
        <CardContent className="p-3">
          <TeamFiltersBar value={teamFilters} onChange={setTeamFilters} />
        </CardContent>
      </Card>

      {/* ===== Tarefas ===== */}
      <section>
        <SectionHeader title="Minhas tarefas" count={(tasksQuery.data || []).length} />
        {tasksQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (tasksQuery.data || []).length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sem tarefas pendentes.
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            <TaskGroup
              title="Atrasadas"
              tone="vermelho"
              items={atrasadas}
              onToggle={(id) => completeTask.mutate(id)}
              emptyText="Sem tarefas atrasadas — bom trabalho!"
            />
            <TaskGroup
              title="Hoje"
              tone="amarelo"
              items={hoje}
              onToggle={(id) => completeTask.mutate(id)}
              emptyText="Nada vence hoje."
            />
            <TaskGroup
              title="Esta semana"
              tone="neutro"
              items={semana}
              onToggle={(id) => completeTask.mutate(id)}
              emptyText="Sem tarefas para esta semana."
            />
          </div>
        )}
      </section>

      {/* ===== Projetos ===== */}
      <section>
        <SectionHeader title="Meus projetos" count={fProjects.length} />
        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
          </div>
        ) : fProjects.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Você ainda não está em nenhum projeto.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {fProjects.map((p) => (
              <Link key={p.id} to={`/projetos/${p.id}`}>
                <Card className="h-full hover:border-brand-500 transition-colors cursor-pointer">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {p.code && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{p.code}</p>}
                        <h3 className="font-bold text-sm truncate">{p.name}</h3>
                      </div>
                      <HealthBadge h={p.health} />
                    </div>
                    <Progress value={0} className="h-1.5" />
                    {p.end_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Fim: {new Date(p.end_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== Reuniões agendadas ===== */}
      <section>
        <SectionHeader title="Minhas reuniões" count={fMeetings.length} />
        {meetingsQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : fMeetings.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma reunião agendada.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {fMeetings.map((m: any) => {
              const dt = new Date(m.scheduled_at);
              return (
                <Link
                  key={m.id}
                  to={`/reunioes/${m.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-brand-500 transition-colors"
                >
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {dt.toLocaleDateString("pt-BR")} · {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {m.location ? ` · ${m.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">{m.modality}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== Aprovações ===== */}
      <section>
        <SectionHeader title="Aprovações pendentes" count={fApprovals.length} />
        {approvalsQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : fApprovals.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nada esperando sua aprovação.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {fApprovals.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {a.version?.document?.title || "(documento sem título)"}
                      {a.version?.version_no && <span className="text-muted-foreground font-normal"> · v{a.version.version_no}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.version?.document?.project?.name || "—"} · enviado em{" "}
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
                    onClick={() => setDecisionModal({ id: a.id, kind: "aprovado" })}
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10 uppercase font-bold"
                    onClick={() => setDecisionModal({ id: a.id, kind: "rejeitado" })}
                  >
                    Rejeitar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ===== Pendências dos liderados ===== */}
      <section>
        <SectionHeader
          title="Pendências dos liderados"
          count={managedBuckets.atrasadas.length + managedBuckets.abertas.length}
        />
        {managedQuery.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (managedBuckets.atrasadas.length + managedBuckets.abertas.length) === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma pendência atribuída em reuniões que você gerencia.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <ManagedGroup
              title="Atrasadas"
              tone="vermelho"
              items={managedBuckets.atrasadas}
              emptyText="Nenhuma pendência atrasada."
            />
            <ManagedGroup
              title="Abertas"
              tone="neutro"
              items={managedBuckets.abertas}
              emptyText="Sem pendências em aberto."
            />
          </div>
        )}
      </section>


      <Dialog open={!!decisionModal} onOpenChange={(o) => { if (!o) { setDecisionModal(null); setComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionModal?.kind === "aprovado" ? "Aprovar documento" : "Rejeitar documento"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Comentário (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDecisionModal(null); setComment(""); }}>Cancelar</Button>
            <Button
              className={decisionModal?.kind === "aprovado"
                ? "bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90 uppercase font-bold"}
              onClick={() => decisionModal && decideApproval.mutate({ id: decisionModal.id, kind: decisionModal.kind, comment })}
              disabled={decideApproval.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskGroup({
  title, tone, items, onToggle, emptyText,
}: {
  title: string;
  tone: "vermelho" | "amarelo" | "neutro";
  items: Task[];
  onToggle: (id: string) => void;
  emptyText: string;
}) {
  const accent =
    tone === "vermelho" ? "text-destructive" :
    tone === "amarelo" ? "text-warning" :
    "text-muted-foreground";
  const Icon = tone === "vermelho" ? AlertCircle : tone === "amarelo" ? Calendar : CheckCircle2;

  return (
    <Collapsible defaultOpen={items.length > 0}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-1 py-1 group">
        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
          {title}
          <span className="font-mono text-muted-foreground">({items.length})</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">{emptyText}</p>
        ) : (
          items.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ManagedItem = {
  id: string;
  meeting_id: string;
  meeting_title: string;
  title: string;
  assignee_name: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: string;
  status: string;
};

function ManagedGroup({
  title, tone, items, emptyText,
}: {
  title: string;
  tone: "vermelho" | "amarelo" | "neutro";
  items: ManagedItem[];
  emptyText: string;
}) {
  const accent =
    tone === "vermelho" ? "text-destructive" :
    tone === "amarelo" ? "text-warning" :
    "text-muted-foreground";
  const Icon = tone === "vermelho" ? AlertCircle : tone === "amarelo" ? CheckCircle2 : Calendar;

  // Agrupa por responsável
  const grouped = items.reduce((acc, it) => {
    const key = it.assignee_name || it.assignee_email || "Sem responsável";
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {} as Record<string, ManagedItem[]>);
  const responsaveis = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <Collapsible defaultOpen={items.length > 0}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-1 py-1 group">
        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
          {title}
          <span className="font-mono text-muted-foreground">({items.length})</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 mt-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">{emptyText}</p>
        ) : (
          responsaveis.map((nome) => (
            <div key={nome} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-semibold text-foreground">{nome}</span>
                <span className="text-xs font-mono text-muted-foreground">({grouped[nome].length})</span>
              </div>
              <div className="space-y-2">
                {grouped[nome].map((it) => {
                  const overdue = it.due_date && it.due_date < todayISO() && it.status !== "concluida";
                  return (
                    <Link
                      key={it.id}
                      to={`/reunioes/${it.meeting_id}#ai-${it.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-brand-500 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{it.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{it.meeting_title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {it.due_date && (
                          <span className={`text-xs flex items-center gap-1 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {new Date(`${it.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                            {overdue && " · atrasada"}
                          </span>
                        )}
                        <PriorityBadge p={it.priority} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

