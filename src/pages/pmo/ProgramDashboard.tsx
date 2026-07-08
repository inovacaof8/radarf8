import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge, HealthBadge } from "@/components/pmo/StatusBadge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, ReferenceLine, LabelList,
} from "recharts";
import {
  FolderKanban, AlertTriangle, DollarSign, TrendingUp, CheckCircle2, Clock, ArrowLeft,
} from "lucide-react";
import ProgramPdfExport from "@/components/pmo/ProgramPdfExport";

const STATUS_COLORS: Record<string, string> = {
  planejado:  "hsl(var(--muted-foreground))",
  ativo:      "hsl(var(--primary))",
  pausado:    "hsl(var(--warning))",
  concluido:  "hsl(var(--success))",
  cancelado:  "hsl(var(--destructive))",
  iniciacao:  "hsl(var(--muted-foreground))",
  planejamento: "hsl(var(--primary))",
  execucao: "hsl(var(--primary))",
  encerramento: "hsl(var(--success))",
};

const HEALTH_COLORS: Record<string, string> = {
  verde:    "hsl(var(--success))",
  amarelo:  "hsl(var(--warning))",
  vermelho: "hsl(var(--destructive))",
};

export default function ProgramDashboard() {
  const { id } = useParams<{ id: string }>();

  const program = useQuery({
    queryKey: ["program-dash-info", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program")
        .select("id, name, status, benefits, start_date, end_date, portfolio:portfolio_id(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const projects = useQuery({
    queryKey: ["program-dash-projects", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project")
        .select("id, name, code, status, health, budget_planned, budget_spent, start_date, end_date, baseline_end_date")
        .eq("program_id", id!);
      if (error) throw error;
      return data || [];
    },
  });

  const projectIds = (projects.data || []).map((p) => p.id);

  const tasks = useQuery({
    queryKey: ["program-dash-tasks", id, projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("task")
        .select("id, name, status, end_date, project_id")
        .in("project_id", projectIds);
      return data || [];
    },
  });

  const risks = useQuery({
    queryKey: ["program-dash-risks", id, projectIds.join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("risk")
        .select("id, description, exposure, status, project_id")
        .in("project_id", projectIds)
        .order("exposure", { ascending: false, nullsFirst: false })
        .limit(10);
      return data || [];
    },
  });

  const loading = program.isLoading || projects.isLoading;

  const todayISO = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const overdueTasksList = useMemo(() => {
    return (tasks.data || []).filter(
      (t: any) => t.end_date && t.status !== "concluida" && t.end_date < todayISO
    );
  }, [tasks.data, todayISO]);

  const kpis = useMemo(() => {
    const ps = projects.data || [];
    const active = ps.filter((p) => p.status === "ativo" || p.status === "execucao").length;
    const concluded = ps.filter((p) => p.status === "concluido" || p.status === "encerramento").length;
    const delayed = ps.filter(
      (p) => p.end_date && p.status !== "concluido" && p.end_date < todayISO
    ).length;
    const planned = ps.reduce((s, p) => s + Number(p.budget_planned || 0), 0);
    const spent = ps.reduce((s, p) => s + Number(p.budget_spent || 0), 0);
    return { total: ps.length, active, concluded, delayed, planned, spent, overdueTasks: overdueTasksList.length };
  }, [projects.data, overdueTasksList, todayISO]);

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

  const budgetByProject = useMemo(() => {
    return (projects.data || [])
      .filter((p) => Number(p.budget_planned || 0) || Number(p.budget_spent || 0))
      .map((p) => {
        const planejado = Number(p.budget_planned || 0);
        const gasto = Number(p.budget_spent || 0);
        const variacao = gasto - planejado;
        return {
          name: p.code || p.name.substring(0, 18),
          planejado,
          gasto,
          variacao,
          consumoPct: planejado > 0 ? Math.round((gasto / planejado) * 100) : 0,
        };
      })
      .sort((a, b) => b.variacao - a.variacao);
  }, [projects.data]);

  const driftByProject = useMemo(() => {
    return (projects.data || [])
      .filter((p) => p.end_date && p.baseline_end_date && p.status !== "cancelado")
      .map((p) => {
        const ms = new Date(p.end_date!).getTime() - new Date(p.baseline_end_date!).getTime();
        const dias = Math.round(ms / 86400000);
        return { name: p.code || p.name.substring(0, 18), dias };
      })
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 12);
  }, [projects.data]);

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
        <PageHeader title="Dashboard do programa" description="Carregando..." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!program.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Programa não encontrado" />
        <Button asChild variant="outline"><Link to="/programas"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
      </div>
    );
  }

  const cards = [
    { label: "Projetos no programa", value: kpis.total, icon: FolderKanban, tone: "text-primary" },
    { label: "Ativos", value: kpis.active, icon: FolderKanban, tone: "text-primary" },
    { label: "Concluídos", value: kpis.concluded, icon: CheckCircle2, tone: "text-success" },
    { label: "Atrasados", value: kpis.delayed, icon: AlertTriangle, tone: "text-destructive" },
  ];

  const burnPct = kpis.planned > 0 ? Math.round((kpis.spent / kpis.planned) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dashboard · ${program.data.name}`}
        description={`Programa do portfolio ${(program.data as any).portfolio?.name || "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <ProgramPdfExport
              programId={program.data.id}
              programName={program.data.name}
              portfolioName={(program.data as any).portfolio?.name}
            />
            <Button asChild variant="outline" size="sm">
              <Link to="/programas"><ArrowLeft className="h-4 w-4 mr-1" /> Programas</Link>
            </Button>
          </div>
        }
      />

      <div data-program-export className="space-y-6 bg-background">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Orçamento do programa
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saúde dos projetos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribuição de RAG sobre {kpis.total} projeto(s)</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projetos por fase</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Onde estão os {kpis.total} projeto(s) do programa</p>
          </CardHeader>
          <CardContent>
            {!statusData.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {statusData
                  .sort((a, b) => b.value - a.value)
                  .map((s) => {
                    const pct = kpis.total > 0 ? Math.round((s.value / kpis.total) * 100) : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium capitalize">{String(s.name).replace("_", " ")}</span>
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
      </div>

      {driftByProject.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Desvio de prazo por projeto
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Dias de atraso (positivo) ou antecipação (negativo) frente ao baseline
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, driftByProject.length * 32)}>
              <BarChart data={driftByProject} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} unit=" d" />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                <ReferenceLine x={0} stroke="hsl(var(--border))" />
                <Tooltip
                  formatter={(v: number) => [`${v > 0 ? "+" : ""}${v} dias`, "Desvio"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
                  {driftByProject.map((d, i) => (
                    <Cell key={i} fill={d.dias > 0 ? "hsl(var(--destructive))" : d.dias < 0 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"} />
                  ))}
                  <LabelList dataKey="dias" position="right" fontSize={11} formatter={(v: number) => (v > 0 ? `+${v}` : v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {budgetByProject.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Variação orçamentária por projeto
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Estouro (vermelho) ou folga (verde) frente ao planejado · ordenado por maior risco
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, budgetByProject.length * 34)}>
              <BarChart data={budgetByProject} layout="vertical" margin={{ left: 8, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => `R$ ${(v / 1000).toLocaleString("pt-BR")}k`}
                />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                <ReferenceLine x={0} stroke="hsl(var(--border))" />
                <Tooltip
                  formatter={(v: number, n: string, p: any) => {
                    if (n === "variacao") {
                      return [`R$ ${v.toLocaleString("pt-BR")} (${p.payload.consumoPct}% do planejado)`, "Variação"];
                    }
                    return [`R$ ${v.toLocaleString("pt-BR")}`, n];
                  }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                  {budgetByProject.map((d, i) => (
                    <Cell key={i} fill={d.variacao > 0 ? "hsl(var(--destructive))" : d.variacao < 0 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"} />
                  ))}
                  <LabelList
                    dataKey="consumoPct"
                    position="right"
                    fontSize={11}
                    formatter={(v: number) => `${v}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}


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
              <TrendingUp className="h-4 w-4 text-destructive" /> Top riscos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!risks.data?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem riscos cadastrados</p>
            ) : risks.data.map((r) => (
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

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Tarefas em atraso</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-bold">{kpis.overdueTasks}</p>
          {overdueTasksList.length > 0 && (
            <ul className="space-y-1 pt-2 border-t">
              {overdueTasksList.map((t: any) => {
                const proj = (projects.data || []).find((p) => p.id === t.project_id);
                return (
                  <li key={t.id} className="text-sm flex items-center justify-between gap-2">
                    <Link
                      to={`/projetos/${t.project_id}`}
                      className="hover:underline truncate"
                    >
                      <span className="font-medium">{t.name}</span>
                      {proj && <span className="text-muted-foreground"> · {proj.name}</span>}
                    </Link>
                    <span className="text-xs text-destructive font-mono shrink-0">
                      {new Date(t.end_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div data-program-gantt>
        <ProgramGantt projects={projects.data || []} tasks={tasks.data || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderKanban className="h-4 w-4" /> Projetos e prazos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!(projects.data || []).length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum projeto neste programa</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-semibold">Código</th>
                    <th className="px-4 py-2 font-semibold">Projeto</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold">Saúde</th>
                    <th className="px-4 py-2 font-semibold">Início</th>
                    <th className="px-4 py-2 font-semibold">Término baseline</th>
                    <th className="px-4 py-2 font-semibold">Término previsto</th>
                    <th className="px-4 py-2 font-semibold text-right">Desvio (dias)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(projects.data || [])]
                    .sort((a, b) => (a.end_date || "9999").localeCompare(b.end_date || "9999"))
                    .map((p) => {
                      const isLate = p.end_date && p.status !== "concluido" && p.end_date < todayISO;
                      const fmt = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
                      let drift: number | null = null;
                      if (p.end_date && p.baseline_end_date) {
                        const ms = new Date(p.end_date).getTime() - new Date(p.baseline_end_date).getTime();
                        drift = Math.round(ms / 86400000);
                      }
                      return (
                        <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{p.code || "—"}</td>
                          <td className="px-4 py-2">
                            <Link to={`/projetos/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                          </td>
                          <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                          <td className="px-4 py-2"><HealthBadge h={p.health} /></td>
                          <td className="px-4 py-2 text-muted-foreground">{fmt((p as any).start_date)}</td>
                          <td className="px-4 py-2 text-muted-foreground">{fmt(p.baseline_end_date)}</td>
                          <td className={`px-4 py-2 ${isLate ? "text-destructive font-semibold" : ""}`}>{fmt(p.end_date)}</td>
                          <td className={`px-4 py-2 text-right tabular-nums ${drift && drift > 0 ? "text-destructive" : drift && drift < 0 ? "text-success" : "text-muted-foreground"}`}>
                            {drift === null ? "—" : drift > 0 ? `+${drift}` : drift}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

type GanttProject = {
  id: string;
  name: string;
  code?: string | null;
  status: string;
  health: string;
  start_date?: string | null;
  end_date?: string | null;
  baseline_end_date?: string | null;
};

function ProgramGantt({
  projects,
  tasks,
}: {
  projects: GanttProject[];
  tasks: { project_id: string; end_date: string | null }[];
}) {
  // Build derived end date: project.end_date || baseline_end_date || max(task.end_date)
  const maxTaskEndByProject = new Map<string, string>();
  for (const t of tasks) {
    if (!t.end_date) continue;
    const cur = maxTaskEndByProject.get(t.project_id);
    if (!cur || t.end_date > cur) maxTaskEndByProject.set(t.project_id, t.end_date);
  }

  const items = projects
    .map((p) => ({
      ...p,
      _end:
        p.end_date ||
        p.baseline_end_date ||
        maxTaskEndByProject.get(p.id) ||
        null,
    }))
    .filter((p) => p.start_date && p._end)
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));

  if (!items.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Gantt do programa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum projeto com datas de início e término definidas
          </p>
        </CardContent>
      </Card>
    );
  }

  const parse = (d: string) => new Date(d + "T00:00:00").getTime();
  const dayMs = 86400000;

  const minTs = Math.min(...items.map((p) => parse(p.start_date!)));
  const maxTs = Math.max(
    ...items.map((p) => Math.max(parse(p._end!), p.baseline_end_date ? parse(p.baseline_end_date) : 0))
  );
  const totalDays = Math.max(1, Math.round((maxTs - minTs) / dayMs));

  // Month markers
  const months: { label: string; left: number }[] = [];
  const start = new Date(minTs);
  start.setDate(1);
  const end = new Date(maxTs);
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const left = ((cursor.getTime() - minTs) / dayMs / totalDays) * 100;
    months.push({
      label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      left: Math.max(0, left),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const today = Date.now();
  const todayLeft =
    today >= minTs && today <= maxTs ? ((today - minTs) / dayMs / totalDays) * 100 : null;

  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Gantt do programa
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Linha do tempo dos projetos · barra clara = baseline, barra sólida = previsto
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Header months */}
            <div className="flex">
              <div className="w-56 shrink-0" />
              <div className="relative flex-1 h-6 border-b border-border">
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full text-[10px] uppercase text-muted-foreground border-l border-border pl-1"
                    style={{ left: `${m.left}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="relative">
              {todayLeft !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-destructive/70 z-10 pointer-events-none"
                  style={{ left: `calc(14rem + ${todayLeft}% * (100% - 14rem) / 100)` }}
                  aria-hidden
                />
              )}
              {items.map((p) => {
                const s = parse(p.start_date!);
                const e = parse(p._end!);
                const left = ((s - minTs) / dayMs / totalDays) * 100;
                const width = Math.max(0.5, ((e - s) / dayMs / totalDays) * 100);
                const baseEnd = p.baseline_end_date ? parse(p.baseline_end_date) : null;
                const baseWidth =
                  baseEnd !== null ? Math.max(0.5, ((baseEnd - s) / dayMs / totalDays) * 100) : null;
                const color = HEALTH_COLORS[p.health] || "hsl(var(--primary))";
                const endIsEstimated = !p.end_date;

                return (
                  <div key={p.id} className="flex items-center border-b border-border/50 py-2">
                    <Link
                      to={`/projetos/${p.id}`}
                      className="w-56 shrink-0 pr-3 min-w-0 hover:underline"
                    >
                      {p.code && (
                        <p className="text-[10px] uppercase font-mono text-muted-foreground truncate">
                          {p.code}
                        </p>
                      )}
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </Link>
                    <div className="relative flex-1 h-7">
                      {baseWidth !== null && (
                        <div
                          className="absolute top-1 h-2 rounded-sm opacity-30"
                          style={{ left: `${left}%`, width: `${baseWidth}%`, background: color }}
                          title={`Baseline: ${fmt(p.start_date!)} → ${fmt(p.baseline_end_date!)}`}
                        />
                      )}
                      <div
                        className={`absolute top-3.5 h-3 rounded-sm shadow-sm ${endIsEstimated ? "opacity-60 border border-dashed border-foreground/30" : ""}`}
                        style={{ left: `${left}%`, width: `${width}%`, background: color }}
                        title={`${fmt(p.start_date!)} → ${fmt(p._end!)}${endIsEstimated ? " (estimado)" : ""}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded-sm bg-success/30" /> Baseline
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-2 rounded-sm bg-success" /> Previsto (cor = saúde)
              </span>
              {todayLeft !== null && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-px h-3 bg-destructive" /> Hoje
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
