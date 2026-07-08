import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, HealthBadge } from "@/components/pmo/StatusBadge";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import {
  FolderKanban, AlertTriangle, DollarSign, TrendingUp, CheckCircle2, Clock,
} from "lucide-react";
import { TeamFiltersBar, EMPTY_FILTERS, type TeamFiltersValue } from "@/components/filters/TeamFiltersBar";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { useTeamFilterOptions } from "@/hooks/useTeamFilterOptions";

const STATUS_COLORS: Record<string, string> = {
  planejado:    "hsl(var(--muted-foreground))",
  iniciacao:    "hsl(var(--muted-foreground))",
  planejamento: "hsl(var(--primary))",
  ativo:        "hsl(var(--primary))",
  execucao:     "hsl(var(--primary))",
  pausado:      "hsl(var(--warning))",
  encerramento: "hsl(var(--success))",
  concluido:    "hsl(var(--success))",
  cancelado:    "hsl(var(--destructive))",
};

const STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  iniciacao: "Iniciação",
  planejamento: "Planejamento",
  ativo: "Ativo",
  execucao: "Execução",
  pausado: "Pausado",
  encerramento: "Encerramento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const HEALTH_COLORS: Record<string, string> = {
  verde:    "hsl(var(--success))",
  amarelo:  "hsl(var(--warning))",
  vermelho: "hsl(var(--destructive))",
};

export default function PMODashboard() {
  const [filters, setFilters] = usePersistedFilters<TeamFiltersValue>("pmo-dashboard", EMPTY_FILTERS);
  const { people } = useTeamFilterOptions();

  const projectsRaw = useQuery({
    queryKey: ["dash-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project")
        .select("id, name, code, status, health, budget_planned, budget_spent, end_date, baseline_end_date, portfolio_id, manager_id");
      if (error) throw error;
      return data || [];
    },
  });

  const tasks = useQuery({
    queryKey: ["dash-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("task").select("status, end_date, project_id");
      return data || [];
    },
  });

  const risks = useQuery({
    queryKey: ["dash-risks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("risk")
        .select("id, description, exposure, status, project_id")
        .order("exposure", { ascending: false, nullsFirst: false })
        .limit(10);
      return data || [];
    },
  });

  const portfolios = useQuery({
    queryKey: ["dash-portfolios"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name");
      return data || [];
    },
  });

  const loading =
    projectsRaw.isLoading || tasks.isLoading || risks.isLoading || portfolios.isLoading;

  // Aplica filtros aos projetos (área via gestor, pessoa = gestor, status, período = end_date)
  const projects = useMemo(() => {
    const personArea = new Map(people.map((p) => [p.user_id, p.primary_area_id]));
    const all = projectsRaw.data || [];
    return {
      data: all.filter((p: any) => {
        if (filters.personIds.length && (!p.manager_id || !filters.personIds.includes(p.manager_id))) return false;
        if (filters.areaIds.length) {
          const aid = p.manager_id ? personArea.get(p.manager_id) ?? null : null;
          if (!aid || !filters.areaIds.includes(aid)) return false;
        }
        if (filters.statuses.length && !filters.statuses.includes(p.status)) return false;
        if (filters.period.from && (!p.end_date || p.end_date < filters.period.from)) return false;
        if (filters.period.to && (!p.end_date || p.end_date > filters.period.to)) return false;
        return true;
      }),
    };
  }, [projectsRaw.data, filters, people]);

  const projectIdSet = useMemo(
    () => new Set((projects.data || []).map((p: any) => p.id)),
    [projects.data],
  );

  const kpis = useMemo(() => {
    const ps = projects.data || [];
    const ts = (tasks.data || []).filter((t: any) => !t.project_id || projectIdSet.has(t.project_id));
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const active = ps.filter((p) => p.status === "ativo" || p.status === "execucao").length;
    const concluded = ps.filter((p) => p.status === "concluido" || p.status === "encerramento").length;
    const delayed = ps.filter(
      (p) => p.end_date && p.status !== "concluido" && p.status !== "encerramento" && p.status !== "cancelado" && new Date(p.end_date) < today
    ).length;
    const planned = ps.reduce((s, p) => s + Number(p.budget_planned || 0), 0);
    const spent = ps.reduce((s, p) => s + Number(p.budget_spent || 0), 0);
    const overdueTasks = ts.filter(
      (t) => t.end_date && t.status !== "concluida" && new Date(t.end_date) < today
    ).length;

    return { total: ps.length, active, concluded, delayed, planned, spent, overdueTasks };
  }, [projects.data, tasks.data, projectIdSet]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    (projects.data || []).forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }));
  }, [projects.data]);

  const healthData = useMemo(() => {
    const counts: Record<string, number> = { verde: 0, amarelo: 0, vermelho: 0 };
    (projects.data || []).forEach((p) => {
      if (p.health) counts[p.health] = (counts[p.health] || 0) + 1;
    });
    return Object.entries(counts).map(([k, v]) => ({ name: k, value: v }));
  }, [projects.data]);

  const portfolioData = useMemo(() => {
    const map = new Map<string, { name: string; planejado: number; gasto: number }>();
    (portfolios.data || []).forEach((p) => map.set(p.id, { name: p.name, planejado: 0, gasto: 0 }));
    (projects.data || []).forEach((p) => {
      if (!p.portfolio_id) return;
      const e = map.get(p.portfolio_id);
      if (!e) return;
      e.planejado += Number(p.budget_planned || 0);
      e.gasto += Number(p.budget_spent || 0);
    });
    return Array.from(map.values()).filter((e) => e.planejado || e.gasto);
  }, [projects.data, portfolios.data]);

  const criticalProjects = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (projects.data || [])
      .filter((p) => {
        if (p.status === "concluido" || p.status === "cancelado") return false;
        const overBudget = p.budget_planned && Number(p.budget_spent || 0) > Number(p.budget_planned);
        const isLate = p.end_date && new Date(p.end_date) < today;
        return p.health === "vermelho" || overBudget || isLate;
      })
      .slice(0, 8);
  }, [projects.data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard executivo" description="Indicadores de portfólio em tempo real" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const cards = [
    { label: "Projetos ativos", value: kpis.active, icon: FolderKanban, tone: "text-primary" },
    { label: "Concluídos", value: kpis.concluded, icon: CheckCircle2, tone: "text-success" },
    { label: "Atrasados", value: kpis.delayed, icon: AlertTriangle, tone: "text-destructive" },
    { label: "Tarefas em atraso", value: kpis.overdueTasks, icon: Clock, tone: "text-warning" },
  ];

  const burnPct = kpis.planned > 0 ? Math.round((kpis.spent / kpis.planned) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard executivo" description="Indicadores de portfólio em tempo real" />

      <Card>
        <CardContent className="p-3">
          <TeamFiltersBar
            value={filters}
            onChange={setFilters}
            show={{ area: true, person: true, status: true, period: true, priority: false }}
            statusOptions={[
              { value: "planejado", label: "Planejado" },
              { value: "iniciacao", label: "Iniciação" },
              { value: "planejamento", label: "Planejamento" },
              { value: "ativo", label: "Ativo" },
              { value: "execucao", label: "Execução" },
              { value: "pausado", label: "Pausado" },
              { value: "encerramento", label: "Encerramento" },
              { value: "concluido", label: "Concluído" },
              { value: "cancelado", label: "Cancelado" },
            ]}
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.tone}`} />
              </div>
              <p className="f8-stat mt-2">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orçamento global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Orçamento global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Planejado</p>
              <p className="text-2xl font-bold">R$ {kpis.planned.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Gasto</p>
              <p className="text-2xl font-bold">R$ {kpis.spent.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Consumo</p>
              <p className={`text-2xl font-bold ${burnPct > 100 ? "text-destructive" : "text-foreground"}`}>{burnPct}%</p>
              <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                <div
                  className={burnPct > 100 ? "bg-destructive h-full" : "bg-primary h-full"}
                  style={{ width: `${Math.min(burnPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projetos por fase</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribuição sobre {kpis.total} projeto(s)</p>
          </CardHeader>
          <CardContent>
            {!statusData.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {statusData
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((s) => {
                    const pct = kpis.total > 0 ? Math.round((s.value / kpis.total) * 100) : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{STATUS_LABELS[s.name] || s.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {s.value} <span className="text-xs">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-3 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${pct}%`, background: STATUS_COLORS[s.name] || "hsl(var(--primary))" }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saúde dos projetos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribuição RAG sobre {kpis.total} projeto(s)</p>
          </CardHeader>
          <CardContent>
            {!healthData.some((h) => h.value > 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados de saúde</p>
            ) : (
              <div className="space-y-3">
                {healthData.map((h) => {
                  const pct = kpis.total > 0 ? Math.round((h.value / kpis.total) * 100) : 0;
                  const labels: Record<string, string> = { verde: "No prazo / saudável", amarelo: "Atenção", vermelho: "Crítico" };
                  return (
                    <div key={h.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{labels[h.name] || h.name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {h.value} <span className="text-xs">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, background: HEALTH_COLORS[h.name] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {portfolioData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Orçamento por portfolio</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={portfolioData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Bar dataKey="planejado" fill="hsl(var(--primary))" name="Planejado" />
                <Bar dataKey="gasto" fill="hsl(var(--warning))" name="Gasto" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Listas críticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Projetos críticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!criticalProjects.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto crítico</p>
            ) : criticalProjects.map((p) => (
              <Link
                key={p.id}
                to={`/projetos/${p.id}`}
                className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  {p.code && <p className="text-[10px] uppercase font-mono text-muted-foreground">{p.code}</p>}
                  <p className="text-sm font-medium truncate">{p.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <HealthBadge h={p.health} />
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-destructive" /> Top riscos por exposição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!(risks.data || []).filter((r:any) => !r.project_id || projectIdSet.has(r.project_id)).length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem riscos cadastrados</p>
            ) : (risks.data || []).filter((r:any) => !r.project_id || projectIdSet.has(r.project_id)).map((r) => (
              <Link
                key={r.id}
                to={`/projetos/${r.project_id}`}
                className="flex items-start justify-between gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm flex-1 line-clamp-2">{r.description}</p>
                <Badge
                  className={
                    (r.exposure || 0) >= 15 ? "bg-destructive text-destructive-foreground" :
                    (r.exposure || 0) >= 8  ? "bg-warning text-warning-foreground" :
                                              "bg-success text-success-foreground"
                  }
                >
                  {r.exposure ?? "—"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
