import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/pmo/StatusBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarRange, Search, ArrowRight, ChevronRight, FolderKanban } from "lucide-react";
import { TeamFiltersBar, EMPTY_FILTERS } from "@/components/filters/TeamFiltersBar";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { useTeamFilterOptions } from "@/hooks/useTeamFilterOptions";

const PROJECT_STATUS_OPTIONS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export default function SchedulesIndex() {
  const [q, setQ] = useState("");
  const [filters, setFilters] = usePersistedFilters("schedules-index", EMPTY_FILTERS);
  const { people } = useTeamFilterOptions();

  const personArea = useMemo(() => {
    const m = new Map<string, string | null>();
    people.forEach((p) => m.set(p.user_id, p.primary_area_id));
    return m;
  }, [people]);

  const projects = useQuery({
    queryKey: ["schedules-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project")
        .select("id, code, name, status, end_date, manager_id, portfolio_id, portfolio:portfolio_id(id, name), program:program_id(name)")
        .order("end_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const taskStats = useQuery({
    queryKey: ["schedules-task-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("task").select("project_id, status");
      const map = new Map<string, { total: number; done: number; doing: number }>();
      (data || []).forEach((t: any) => {
        const e = map.get(t.project_id) || { total: 0, done: 0, doing: 0 };
        e.total++;
        if (t.status === "concluida") e.done++;
        if (t.status === "em_andamento") e.doing++;
        map.set(t.project_id, e);
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (projects.data || []).filter((p: any) => {
      if (s && !(p.name.toLowerCase().includes(s) || (p.code || "").toLowerCase().includes(s) || (p.portfolio?.name || "").toLowerCase().includes(s))) return false;
      if (filters.personIds.length && (!p.manager_id || !filters.personIds.includes(p.manager_id))) return false;
      if (filters.areaIds.length) {
        const aid = p.manager_id ? personArea.get(p.manager_id) ?? null : null;
        if (!aid || !filters.areaIds.includes(aid)) return false;
      }
      if (filters.statuses.length && !filters.statuses.includes(p.status)) return false;
      if (filters.period.from || filters.period.to) {
        if (!p.end_date) return false;
        if (filters.period.from && p.end_date < filters.period.from) return false;
        if (filters.period.to && p.end_date > filters.period.to) return false;
      }
      return true;
    });
  }, [projects.data, q, filters, personArea]);

  // Group projects by portfolio
  const grouped = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; projects: any[] }>();
    filtered.forEach((p: any) => {
      const key = p.portfolio?.id || "__none__";
      const name = p.portfolio?.name || "Sem portfólio";
      if (!map.has(key)) map.set(key, { id: p.portfolio?.id ?? null, name, projects: [] });
      map.get(key)!.projects.push(p);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
  }, [filtered]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => openMap[k] ?? false;
  const toggle = (k: string) => setOpenMap((m) => ({ ...m, [k]: !isOpen(k) }));

  return (
    <div>
      <PageHeader
        title="Cronogramas"
        description="Visão consolidada por portfólio — expanda para ver os projetos."
      />

      <Card className="mb-4">
        <CardContent className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar portfólio ou projeto..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <TeamFiltersBar
            value={filters}
            onChange={setFilters}
            statusOptions={PROJECT_STATUS_OPTIONS}
            show={{ area: true, person: true, status: true, priority: false, period: true }}
          />
        </CardContent>
      </Card>

      {projects.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">
          <CalendarRange className="h-10 w-10 mx-auto mb-2 opacity-30" />
          Nenhum projeto encontrado.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => {
            const totals = g.projects.reduce(
              (acc, p) => {
                const s = taskStats.data?.get(p.id);
                acc.tasks += s?.total ?? 0;
                acc.done += s?.done ?? 0;
                return acc;
              },
              { tasks: 0, done: 0 }
            );
            const pct = totals.tasks ? Math.round((totals.done / totals.tasks) * 100) : 0;
            const key = g.id || "__none__";
            const open = isOpen(key);
            return (
              <Card key={key} className="overflow-hidden">
                <Collapsible open={open} onOpenChange={() => toggle(key)}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full text-left">
                      <CardContent className="p-4 flex items-center gap-3 hover:bg-accent/40 transition-colors">
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
                        <FolderKanban className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{g.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.projects.length} projeto{g.projects.length !== 1 && "s"} · {totals.tasks} tarefas · {pct}% concluído
                          </p>
                        </div>
                        <div className="hidden sm:block w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </CardContent>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {g.projects.map((p: any) => {
                        const stats = taskStats.data?.get(p.id);
                        const ppct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;
                        return (
                          <Link key={p.id} to={`/projetos/${p.id}?tab=cronograma`}>
                            <Card className="hover:border-primary transition-colors h-full">
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    {p.code && <p className="text-[10px] uppercase font-mono text-muted-foreground">{p.code}</p>}
                                    <p className="font-semibold truncate text-sm">{p.name}</p>
                                    {p.program?.name && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        <Badge variant="outline" className="text-[10px]">{p.program.name}</Badge>
                                      </div>
                                    )}
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <StatusBadge status={p.status} />
                                  <span className="text-muted-foreground">
                                    {stats?.total ?? 0} tarefas · {ppct}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${ppct}%` }} />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
