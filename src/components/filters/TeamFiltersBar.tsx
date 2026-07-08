import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useTeamFilterOptions } from "@/hooks/useTeamFilterOptions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PeriodValue {
  from?: string; // ISO date (yyyy-MM-dd)
  to?: string;
  preset?: "today" | "7d" | "30d" | "month" | "custom";
}

export interface TeamFiltersValue {
  areaIds: string[];
  personIds: string[];
  statuses: string[];
  priorities: string[];
  period: PeriodValue;
}

export const EMPTY_FILTERS: TeamFiltersValue = {
  areaIds: [], personIds: [], statuses: [], priorities: [], period: {},
};

export function hasActiveFilters(v: TeamFiltersValue) {
  return v.areaIds.length > 0 || v.personIds.length > 0 || v.statuses.length > 0 ||
    v.priorities.length > 0 || !!v.period.from || !!v.period.to;
}

interface Opt { value: string; label: string; sub?: string }

function MultiSelect({
  label, options, value, onChange, placeholder, searchPlaceholder,
}: {
  label: string;
  options: Opt[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value.length;
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between font-normal min-w-[140px]">
          <span className="truncate">
            {label}
            {selected > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-4 text-[10px]">{selected}</Badge>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder ?? "Buscar..."} />
          <CommandList>
            <CommandEmpty>{placeholder ?? "Sem opções"}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const checked = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.sub ?? ""} ${o.value}`}
                    onSelect={() => toggle(o.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">
                      {o.label}
                      {o.sub && <span className="text-muted-foreground"> · {o.sub}</span>}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (v: PeriodValue) => void }) {
  const [open, setOpen] = useState(false);

  const apply = (preset: PeriodValue["preset"]) => {
    const now = new Date();
    if (preset === "today") {
      const t = localISO(now);
      onChange({ preset, from: t, to: t });
    } else if (preset === "7d") {
      const end = new Date(); end.setDate(end.getDate() + 7);
      onChange({ preset, from: localISO(now), to: localISO(end) });
    } else if (preset === "30d") {
      const end = new Date(); end.setDate(end.getDate() + 30);
      onChange({ preset, from: localISO(now), to: localISO(end) });
    } else if (preset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      onChange({ preset, from: localISO(start), to: localISO(end) });
    }
    setOpen(false);
  };

  const label = value.from || value.to
    ? `${value.from ? format(new Date(value.from + "T00:00:00"), "dd/MM", { locale: ptBR }) : "…"} – ${value.to ? format(new Date(value.to + "T00:00:00"), "dd/MM", { locale: ptBR }) : "…"}`
    : "Período";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between font-normal min-w-[140px]">
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-3.5 w-3.5" />
            {label}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-2" align="start">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={value.preset === "today" ? "default" : "outline"} onClick={() => apply("today")}>Hoje</Button>
          <Button size="sm" variant={value.preset === "7d" ? "default" : "outline"} onClick={() => apply("7d")}>7 dias</Button>
          <Button size="sm" variant={value.preset === "30d" ? "default" : "outline"} onClick={() => apply("30d")}>30 dias</Button>
          <Button size="sm" variant={value.preset === "month" ? "default" : "outline"} onClick={() => apply("month")}>Este mês</Button>
          <Button size="sm" variant="ghost" onClick={() => { onChange({}); setOpen(false); }}>Limpar</Button>
        </div>
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Personalizado</p>
          <Calendar
            mode="range"
            selected={{
              from: value.from ? new Date(value.from + "T00:00:00") : undefined,
              to: value.to ? new Date(value.to + "T00:00:00") : undefined,
            }}
            onSelect={(r) => {
              onChange({
                preset: "custom",
                from: r?.from ? localISO(r.from) : undefined,
                to: r?.to ? localISO(r.to) : undefined,
              });
            }}
            className={cn("p-0 pointer-events-auto")}
            numberOfMonths={1}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface TeamFiltersBarProps {
  value: TeamFiltersValue;
  onChange: (v: TeamFiltersValue) => void;
  statusOptions?: Opt[]; // optional override
  priorityOptions?: Opt[];
  show?: { area?: boolean; person?: boolean; status?: boolean; priority?: boolean; period?: boolean };
  periodLabel?: string;
}

const DEFAULT_STATUS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "atrasada", label: "Atrasada" },
];
const DEFAULT_PRIORITY = [
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

export function TeamFiltersBar({
  value, onChange,
  statusOptions = DEFAULT_STATUS,
  priorityOptions = DEFAULT_PRIORITY,
  show = { area: true, person: true, status: true, priority: true, period: true },
}: TeamFiltersBarProps) {
  const { areas, people } = useTeamFilterOptions();

  const areaOpts: Opt[] = useMemo(() => [...areas]
    .sort((a, b) => (a.acronym || a.name).localeCompare(b.acronym || b.name, "pt-BR", { sensitivity: "base", numeric: true }))
    .map((a) => ({ value: a.id, label: a.acronym ? `${a.acronym} — ${a.name}` : a.name })),
    [areas]);

  const personOpts: Opt[] = useMemo(() => {
    let list = [...people];
    if (value.areaIds.length) {
      const set = new Set(value.areaIds);
      list = list.filter((p) => p.primary_area_id && set.has(p.primary_area_id));
    }
    return list
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }))
      .map((p) => ({ value: p.user_id, label: p.name, sub: p.email || undefined }));
  }, [people, value.areaIds]);

  const set = (patch: Partial<TeamFiltersValue>) => onChange({ ...value, ...patch });
  const active = hasActiveFilters(value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.area && (
        <MultiSelect label="Área" options={areaOpts} value={value.areaIds}
          onChange={(v) => {
            // ao mudar áreas, prune pessoas que não pertencem mais às áreas selecionadas
            if (v.length === 0) {
              set({ areaIds: v });
            } else {
              const allowedAreas = new Set(v);
              const allowedPeople = new Set(
                people.filter((p) => p.primary_area_id && allowedAreas.has(p.primary_area_id)).map((p) => p.user_id),
              );
              const prunedPersons = value.personIds.filter((id) => allowedPeople.has(id));
              onChange({ ...value, areaIds: v, personIds: prunedPersons });
            }
          }} searchPlaceholder="Buscar área..." />
      )}
      {show.person && (
        <MultiSelect label="Pessoa" options={personOpts} value={value.personIds}
          onChange={(v) => set({ personIds: v })} searchPlaceholder="Buscar pessoa..." />
      )}
      {show.status && (
        <MultiSelect label="Status" options={statusOptions} value={value.statuses}
          onChange={(v) => set({ statuses: v })} />
      )}
      {show.priority && (
        <MultiSelect label="Prioridade" options={priorityOptions} value={value.priorities}
          onChange={(v) => set({ priorities: v })} />
      )}
      {show.period && (
        <PeriodPicker value={value.period} onChange={(p) => set({ period: p })} />
      )}
      {active && (
        <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground"
          onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );
}
