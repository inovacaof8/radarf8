import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import EmptyState from "@/components/ui/EmptyState";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, Clock, AlertCircle, Sparkles,
  CalendarCheck, ExternalLink, ListTodo,
} from "lucide-react";
import { TarefaDialog, type TarefaRow } from "@/components/tarefa/TarefaDialog";
import { toast } from "sonner";

type PeriodMode = "dia" | "semana" | "mes";

// ---------- date helpers (local time, no TZ shifts) ----------
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftDays(iso: string, days: number) {
  const d = fromISO(iso); d.setDate(d.getDate() + days); return toISO(d);
}
function shiftMonths(iso: string, months: number) {
  const d = fromISO(iso); d.setMonth(d.getMonth() + months); return toISO(d);
}
function startOfWeek(iso: string) {
  // Monday as first day
  const d = fromISO(iso);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}
function startOfMonth(iso: string) {
  const d = fromISO(iso); d.setDate(1); return toISO(d);
}
function endOfMonth(iso: string) {
  const d = fromISO(iso); d.setMonth(d.getMonth() + 1, 0); return toISO(d);
}
function fmtDayLong(iso: string) {
  return fromISO(iso).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}
function fmtShort(iso: string) {
  return fromISO(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtMonthYear(iso: string) {
  return fromISO(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function getRange(mode: PeriodMode, anchor: string): { from: string; to: string } {
  if (mode === "dia") return { from: anchor, to: anchor };
  if (mode === "semana") {
    const from = startOfWeek(anchor);
    return { from, to: shiftDays(from, 6) };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

function rangeLabel(mode: PeriodMode, anchor: string) {
  const { from, to } = getRange(mode, anchor);
  if (mode === "dia") return fmtDayLong(anchor);
  if (mode === "semana") return `${fmtShort(from)} – ${fmtShort(to)}`;
  return fmtMonthYear(anchor).replace(/^./, (c) => c.toUpperCase());
}

const PRIO_COLORS: Record<string, string> = {
  alta: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  media: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  baixa: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const ORIGEM_LABEL: Record<string, string> = {
  manual: "Manual", ia: "IA", reuniao: "Reunião", medicao: "Medição", contrato: "Contrato",
};

export default function MeuDia() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const hoje = toISO(new Date());
  const [mode, setMode] = useState<PeriodMode>("dia");
  const [anchor, setAnchor] = useState<string>(hoje);

  const [openTarefaDialog, setOpenTarefaDialog] = useState(false);
  const [editing, setEditing] = useState<TarefaRow | null>(null);
  const [tarefaDefaultDate, setTarefaDefaultDate] = useState<string>(hoje);

  const [dayActionOpen, setDayActionOpen] = useState(false);
  const [dayActionDate, setDayActionDate] = useState<string>(hoje);

  const range = getRange(mode, anchor);

  // ---------- Tarefas (range) ----------
  const { data: tarefas, isLoading: isLoadingTarefas } = useQuery({
    queryKey: ["tarefas", "range", user?.id, range.from, range.to],
    enabled: !!user,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tarefas" as any)
        .select("*")
        .gte("data", range.from)
        .lte("data", range.to)
        .order("data", { ascending: true })
        .order("hora", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as unknown as TarefaRow[];
    },
  });

  // ---------- Reuniões (range) ----------
  const { data: reunioes, isLoading: isLoadingReunioes } = useQuery({
    queryKey: ["meeting", "range", user?.id, range.from, range.to],
    enabled: !!user,
    queryFn: async () => {
      const start = `${range.from}T00:00:00.000Z`;
      const end = `${range.to}T23:59:59.999Z`;
      const { data: rows, error } = await supabase
        .from("meeting")
        .select("id, title, scheduled_at, location, modality, status, project_id, organizer_id, created_by")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as any[];
    },
  });

  // Critério de "lida": tarefa concluída pelo responsável OU notificação aberta.
  // A marcação é feita por triggers de banco — nada a fazer aqui.


  // Realtime: creator sees read confirmation as soon as recipient opens the task
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("tarefas-assigned-" + user.id)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "tarefas", filter: `created_by=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["tarefas"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);


  // Names for "Atribuída por …" / "Para …" badges
  const peopleIds = useMemo(() => {
    const s = new Set<string>();
    (tarefas ?? []).forEach((t: any) => {
      if (t.user_id && t.user_id !== user?.id) s.add(t.user_id);
      if (t.created_by && t.created_by !== user?.id) s.add(t.created_by);
    });
    return Array.from(s);
  }, [tarefas, user?.id]);

  const { data: peopleNames } = useQuery({
    queryKey: ["tarefa-people", peopleIds.sort().join(",")],
    enabled: peopleIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name").in("user_id", peopleIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.user_id, p.name));
      return m;
    },
  });
  const creators = peopleNames;


  // ---------- Calendar grid (depends on mode + anchor) ----------
  const gridDays = useMemo(() => {
    const a = fromISO(anchor);
    if (mode === "dia") return [a];
    if (mode === "semana") {
      const day = a.getDay(); // 0=Sun
      const start = new Date(a); start.setDate(a.getDate() - day);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i); return d;
      });
    }
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const startWeekday = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
    });
  }, [mode, anchor]);

  const gridFrom = toISO(gridDays[0]);
  const gridTo = toISO(gridDays[gridDays.length - 1]);

  const { data: monthTarefas } = useQuery({
    queryKey: ["tarefas", "grid", user?.id, gridFrom, gridTo],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas" as any)
        .select("*")
        .gte("data", gridFrom).lte("data", gridTo);
      if (error) throw error;
      return (data ?? []) as unknown as TarefaRow[];
    },
  });

  const { data: monthReunioes } = useQuery({
    queryKey: ["meeting", "grid", user?.id, gridFrom, gridTo],
    enabled: !!user,
    queryFn: async () => {
      const start = `${gridFrom}T00:00:00.000Z`;
      const end = `${gridTo}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from("meeting").select("id, title, scheduled_at, organizer_id, created_by")
        .gte("scheduled_at", start).lte("scheduled_at", end);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  type CellEvent = {
    id: string;
    kind: "task" | "meeting";
    title: string;
    time?: string | null;   // "HH:MM" or "HH:MM:SS"
    duration?: number;      // minutes
    priority?: string;
    done?: boolean;
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CellEvent[]>();
    (monthTarefas ?? []).forEach((t) => {
      const arr = map.get(t.data) ?? [];
      arr.push({
        id: t.id, kind: "task", title: t.titulo, time: t.hora,
        duration: t.duracao_min ?? 30,
        priority: t.prioridade, done: t.status === "concluida",
      });
      map.set(t.data, arr);
    });
    (monthReunioes ?? []).forEach((r: any) => {
      const iso = toISO(new Date(r.scheduled_at));
      const arr = map.get(iso) ?? [];
      const time = new Date(r.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      arr.push({ id: r.id, kind: "meeting", title: r.title, time, duration: 60 });
      map.set(iso, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")));
    return map;
  }, [monthTarefas, monthReunioes]);

  const densityByDay = useMemo(() => {
    const m = new Map<string, number>();
    eventsByDay.forEach((arr, iso) => m.set(iso, arr.length));
    return m;
  }, [eventsByDay]);


  // ---------- Mutations ----------
  const toggleStatus = useMutation({
    mutationFn: async (t: TarefaRow) => {
      const novoStatus = t.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase
        .from("tarefas" as any)
        .update({
          status: novoStatus,
          concluida_em: novoStatus === "concluida" ? new Date().toISOString() : null,
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const lista = tarefas ?? [];
    return {
      total: lista.length,
      concluidas: lista.filter((t) => t.status === "concluida").length,
      pendentes: lista.filter((t) => t.status === "pendente" || t.status === "em_andamento").length,
      alta: lista.filter((t) => t.prioridade === "alta" && t.status !== "concluida").length,
    };
  }, [tarefas]);

  // ---------- Navigation arrows ----------
  function shiftAnchor(dir: -1 | 1) {
    if (mode === "dia") setAnchor((a) => shiftDays(a, dir));
    else if (mode === "semana") setAnchor((a) => shiftDays(a, dir * 7));
    else setAnchor((a) => shiftMonths(a, dir));
  }

  // ---------- Group tarefas/reunioes by day (for ranged views) ----------
  const groupedTarefas = useMemo(() => {
    const map = new Map<string, TarefaRow[]>();
    (tarefas ?? []).forEach((t) => {
      const arr = map.get(t.data) ?? [];
      arr.push(t); map.set(t.data, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tarefas]);

  const groupedReunioes = useMemo(() => {
    const map = new Map<string, any[]>();
    (reunioes ?? []).forEach((r: any) => {
      const iso = toISO(new Date(r.scheduled_at));
      const arr = map.get(iso) ?? [];
      arr.push(r); map.set(iso, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [reunioes]);

  const periodTitle = mode === "dia" ? "Meu Dia" : mode === "semana" ? "Minha Semana" : "Meu Mês";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{periodTitle}</h1>
          <p className="text-sm text-muted-foreground capitalize">{rangeLabel(mode, anchor)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md px-1 bg-background">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setAnchor(hoje)}
              className="min-w-[140px] px-2 text-sm font-medium text-foreground text-center hover:text-primary transition-colors capitalize"
              title="Voltar para hoje"
            >
              {rangeLabel(mode, anchor)}
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>


          <Button
            onClick={() => {
              setEditing(null);
              setTarefaDefaultDate(mode === "dia" ? anchor : hoje);
              setOpenTarefaDialog(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tarefas" value={stats.total} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Pendentes" value={stats.pendentes} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Alta prioridade" value={stats.alta} icon={<AlertCircle className="h-4 w-4" />} accent="text-red-500" />
        <StatCard label="Concluídas" value={stats.concluidas} icon={<Sparkles className="h-4 w-4" />} accent="text-emerald-500" />
      </div>

      {/* Reuniões + Tarefas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4 flex flex-col h-full min-h-[300px]">
          <div className="flex items-center justify-between border-b pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              <h2 className="font-extrabold text-base text-foreground">
                Reuniões {mode === "dia" ? "do Dia" : mode === "semana" ? "da Semana" : "do Mês"}
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/reunioes")} className="h-8 gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Ver reuniões
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoadingReunioes ? (
              <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : !reunioes || reunioes.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Sem reuniões neste período"
                description="Use o menu Reuniões ou o calendário abaixo para agendar." />
            ) : (
              <div className="space-y-3">
                {groupedReunioes.map(([iso, items]) => (
                  <div key={iso}>
                    {mode !== "dia" && (
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 capitalize">
                        {fromISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                      </p>
                    )}
                    <div className="space-y-2">
                      {items.map((r: any) => (
                        <button key={r.id} onClick={() => navigate(`/reunioes/${r.id}`)}
                          className="w-full flex items-start justify-between p-3 border rounded-md gap-3 hover:bg-muted/50 transition-colors text-left">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm text-foreground">{r.title}</p>
                              {r.status && <Badge variant="outline" className="text-[10px]">{r.status}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {r.scheduled_at ? new Date(r.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                              {r.modality ? ` · ${r.modality}` : ""}
                              {r.location ? ` · ${r.location}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4 flex flex-col h-full min-h-[300px]">
          <div className="flex items-center gap-2 border-b pb-3 mb-3 shrink-0">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-extrabold text-base text-foreground">
              Tarefas {mode === "dia" ? "do Dia" : mode === "semana" ? "da Semana" : "do Mês"}
            </h2>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoadingTarefas ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : !tarefas || tarefas.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sem tarefas neste período"
                description="Use o botão Nova tarefa ou clique em um dia no calendário." />
            ) : (
              <div className="space-y-3">
                {groupedTarefas.map(([iso, items]) => (
                  <div key={iso}>
                    {mode !== "dia" && (
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1 capitalize">
                        {fromISO(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                      </p>
                    )}
                    <ul className="divide-y divide-border">
                      {items.map((t) => (
                        <li key={t.id} className="py-3 flex items-start gap-3 text-left">
                          <Checkbox checked={t.status === "concluida"}
                            onCheckedChange={() => toggleStatus.mutate(t)} className="mt-1" />
                          <button className="flex-1 text-left min-w-0"
                            onClick={() => { setEditing(t); setTarefaDefaultDate(t.data); setOpenTarefaDialog(true); }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-sm ${t.status === "concluida" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {t.titulo}
                              </span>
                              <Badge variant="outline" className={`text-[10px] ${PRIO_COLORS[t.prioridade]}`}>
                                {t.prioridade}
                              </Badge>
                              {t.origem !== "manual" && (
                                <Badge variant="outline" className="text-[10px]">{ORIGEM_LABEL[t.origem] ?? t.origem}</Badge>
                              )}
                              {(t as any).created_by && (t as any).user_id === user?.id && (t as any).created_by !== user?.id && (
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                                  Atribuída por {creators?.get((t as any).created_by) ?? "líder"}
                                </Badge>
                              )}
                              {(t as any).created_by === user?.id && (t as any).user_id !== user?.id && (
                                <>
                                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                                    Para {peopleNames?.get((t as any).user_id) ?? "outro usuário"}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      (t as any).first_viewed_at
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                    title={(t as any).first_viewed_at ? `Lida em ${new Date((t as any).first_viewed_at).toLocaleString("pt-BR")}` : "Ainda não lida"}
                                  >
                                    {(t as any).first_viewed_at ? "Lida" : "Não lida"}
                                  </Badge>
                                </>
                              )}
                              {(t as any).user_id !== user?.id && (t as any).created_by !== user?.id && (
                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                                  Responsável: {peopleNames?.get((t as any).user_id) ?? "outro usuário"}
                                </Badge>
                              )}

                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                              {t.hora && <span>{t.hora.slice(0, 5)}</span>}
                              {t.duracao_min && <span>{t.duracao_min} min</span>}
                              {t.descricao && <span className="truncate">{t.descricao}</span>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Calendário estilo Apple/Google */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-extrabold text-base text-foreground capitalize">
              {rangeLabel(mode, anchor)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => {
                if (!v) return;
                setMode(v as PeriodMode);
                setAnchor(hoje);
              }}
              className="bg-muted/40 rounded-md p-0.5"
            >
              <ToggleGroupItem value="dia" className="h-8 px-3 text-xs">Hoje</ToggleGroupItem>
              <ToggleGroupItem value="semana" className="h-8 px-3 text-xs">Semana</ToggleGroupItem>
              <ToggleGroupItem value="mes" className="h-8 px-3 text-xs">Mês</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftAnchor(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* === Timeline (Dia / Semana) === */}
        {mode !== "mes" ? (() => {
          const HOUR_START = 6;
          const HOUR_END = 23; // exclusive (last row label = 22)
          const ROW_H = 48;    // px per hour
          const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
          const totalH = HOURS.length * ROW_H;

          const parseMin = (time?: string | null) => {
            if (!time) return null;
            const [h, m] = time.split(":").map(Number);
            return h * 60 + (m || 0);
          };

          const renderDayColumn = (d: Date, showLabel: boolean) => {
            const iso = toISO(d);
            const events = (eventsByDay.get(iso) ?? []).filter((e) => e.time);
            const isToday = iso === hoje;
            return (
              <div key={iso} className="flex-1 min-w-0 border-r last:border-r-0">
                {showLabel && (
                  <button
                    onClick={() => { setDayActionDate(iso); setDayActionOpen(true); }}
                    className="w-full text-center py-2 border-b hover:bg-muted/40 transition-colors"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {d.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </div>
                    <div className={`text-sm font-semibold inline-flex items-center justify-center h-7 w-7 rounded-full ${
                      isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}>
                      {d.getDate()}
                    </div>
                  </button>
                )}
                <div
                  className="relative cursor-pointer"
                  style={{ height: totalH }}
                  onClick={() => { setDayActionDate(iso); setDayActionOpen(true); }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-border/60"
                      style={{ top: i * ROW_H, height: ROW_H }}
                    />
                  ))}
                  {/* Events */}
                  {events.map((ev) => {
                    const startMin = parseMin(ev.time)!;
                    const baseMin = HOUR_START * 60;
                    const top = ((startMin - baseMin) / 60) * ROW_H;
                    const height = Math.max(22, ((ev.duration ?? 30) / 60) * ROW_H - 2);
                    if (top + height < 0 || top > totalH) return null;
                    const colors =
                      ev.kind === "meeting"
                        ? "bg-blue-500/15 border-blue-500 text-blue-800 dark:text-blue-200"
                        : ev.priority === "alta"
                        ? "bg-red-500/15 border-red-500 text-red-800 dark:text-red-200"
                        : ev.priority === "media"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200"
                        : "bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-200";
                    return (
                      <div
                        key={`${ev.kind}-${ev.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ev.kind === "meeting") navigate(`/reunioes/${ev.id}`);
                          else {
                            const t = (monthTarefas ?? []).find((x) => x.id === ev.id) as any;
                            if (t) {
                              setEditing(t as TarefaRow);
                              setTarefaDefaultDate(t.data);
                              setOpenTarefaDialog(true);
                            }
                          }
                        }}
                        className={`absolute left-1 right-1 rounded-md border-l-2 px-1.5 py-0.5 text-[11px] overflow-hidden cursor-pointer hover:opacity-90 ${colors} ${
                          ev.done ? "line-through opacity-60" : ""
                        }`}
                        style={{ top, height }}
                        title={`${ev.time?.slice(0,5)} · ${ev.title}`}
                      >
                        <div className="font-semibold truncate">
                          {ev.time?.slice(0, 5)} {ev.title}
                        </div>
                      </div>
                    );
                  })}
                  {/* "Now" indicator */}
                  {isToday && (() => {
                    const now = new Date();
                    const m = now.getHours() * 60 + now.getMinutes();
                    const baseMin = HOUR_START * 60;
                    if (m < baseMin || m > HOUR_END * 60) return null;
                    const top = ((m - baseMin) / 60) * ROW_H;
                    return (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
                        <div className="h-px bg-red-500" />
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          };

          return (
            <div className="overflow-auto max-h-[640px] border rounded-md">
              <div className="flex">
                {/* Hour gutter */}
                <div className="w-14 shrink-0 border-r bg-muted/20">
                  {mode === "semana" && <div className="h-[60px] border-b" />}
                  <div className="relative" style={{ height: totalH }}>
                    {HOURS.map((h, i) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 text-[10px] text-muted-foreground text-right pr-1.5"
                        style={{ top: i * ROW_H - 6 }}
                      >
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>
                </div>
                {/* Day columns */}
                <div className="flex flex-1 min-w-0">
                  {gridDays.map((d) => renderDayColumn(d, mode === "semana"))}
                </div>
              </div>
            </div>
          );
        })() : (
          <>
            {/* Cabeçalho de dias da semana — Mês */}
            <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-muted-foreground border-b">
              {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-right">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 border-l border-t">
              {gridDays.map((d) => {
                const iso = toISO(d);
                const anchorMonth = fromISO(anchor).getMonth();
                const inMonth = d.getMonth() === anchorMonth;
                const isToday = iso === hoje;
                const isSelected = iso === anchor;
                const events = eventsByDay.get(iso) ?? [];
                const visible = events.slice(0, 3);
                const extra = events.length - visible.length;
                return (
                  <button
                    key={iso}
                    onClick={() => { setDayActionDate(iso); setDayActionOpen(true); }}
                    className={`text-left border-r border-b p-1.5 flex flex-col gap-1 transition-colors hover:bg-muted/40 min-h-[96px] ${
                      inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground"
                    } ${isSelected ? "ring-1 ring-inset ring-primary" : ""}`}
                  >
                    <div className="flex items-center justify-end">
                      <span className={`text-xs font-semibold inline-flex items-center justify-center ${
                        isToday
                          ? "h-6 w-6 rounded-full bg-primary text-primary-foreground"
                          : inMonth ? "text-foreground" : ""
                      }`}>
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {visible.map((ev) => {
                        const dotColor =
                          ev.kind === "meeting" ? "bg-blue-500"
                          : ev.priority === "alta" ? "bg-red-500"
                          : ev.priority === "media" ? "bg-amber-500"
                          : "bg-emerald-500";
                        const bgColor =
                          ev.kind === "meeting" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          : ev.priority === "alta" ? "bg-red-500/10 text-red-700 dark:text-red-300"
                          : ev.priority === "media" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
                        return (
                          <div
                            key={`${ev.kind}-${ev.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (ev.kind === "meeting") navigate(`/reunioes/${ev.id}`);
                              else {
                                const t = (monthTarefas ?? []).find((x) => x.id === ev.id) as any;
                                if (t) {
                                  setEditing(t as TarefaRow);
                                  setTarefaDefaultDate(t.data);
                                  setOpenTarefaDialog(true);
                                }
                              }
                            }}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] truncate cursor-pointer hover:opacity-80 ${bgColor} ${
                              ev.done ? "line-through opacity-60" : ""
                            }`}
                            title={`${ev.time ? ev.time.slice(0,5) + " · " : ""}${ev.title}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                            {ev.time && <span className="font-medium shrink-0">{ev.time.slice(0, 5)}</span>}
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                      {extra > 0 && (
                        <div className="text-[10px] text-muted-foreground px-1.5">+{extra} mais</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}



      </Card>


      {/* Day action dialog */}
      <Dialog open={dayActionOpen} onOpenChange={setDayActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{fmtDayLong(dayActionDate)}</DialogTitle>
            <DialogDescription>
              {(() => {
                const c = densityByDay.get(dayActionDate) ?? 0;
                return c === 0 ? "Nenhum compromisso neste dia." : `${c} compromisso${c > 1 ? "s" : ""} agendado${c > 1 ? "s" : ""}.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMode("dia");
                setAnchor(dayActionDate);
                setDayActionOpen(false);
              }}
              className="gap-2 justify-center"
            >
              <CalendarDays className="h-4 w-4" /> Ver este dia
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDayActionOpen(false);
                setEditing(null);
                setTarefaDefaultDate(dayActionDate);
                setOpenTarefaDialog(true);
              }}
              className="gap-2 justify-center"
            >
              <ListTodo className="h-4 w-4" /> Nova tarefa
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDayActionOpen(false);
                navigate(`/reunioes?new=1&date=${dayActionDate}`);
              }}
              className="gap-2 justify-center sm:col-span-2"
            >
              <CalendarCheck className="h-4 w-4" /> Nova reunião
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TarefaDialog
        open={openTarefaDialog}
        onOpenChange={setOpenTarefaDialog}
        tarefa={editing}
        defaultDate={tarefaDefaultDate}
      />
    </div>
  );
}

function StatCard({ label, value, icon, accent = "text-foreground" }: {
  label: string; value: number; icon: React.ReactNode; accent?: string;
}) {
  return (
    <Card className="p-4 text-left">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
        <span>{label}</span>{icon}
      </div>
      <div className={`mt-2 text-3xl font-extrabold ${accent}`}>{value}</div>
    </Card>
  );
}
