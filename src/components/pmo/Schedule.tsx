import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Link2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import { format, differenceInDays, addDays, max as dateMax, min as dateMin, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Task = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  assignee_id: string | null;
};

const STATUS_COLS = [
  { id: "backlog", label: "Backlog" },
  { id: "em_andamento", label: "Em andamento" },
  { id: "bloqueada", label: "Bloqueada" },
  { id: "concluida", label: "Concluída" },
] as const;

const PRIORITIES = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
  { v: "critica", label: "Crítica" },
];

const priorityColor = (p: string) =>
  p === "critica" ? "bg-destructive text-destructive-foreground"
  : p === "alta" ? "bg-warning text-warning-foreground"
  : p === "media" ? "bg-secondary"
  : "bg-muted text-muted-foreground";

const statusColor = (s: string) =>
  s === "concluida" ? "bg-success text-success-foreground"
  : s === "em_andamento" ? "bg-brand-500 text-ink"
  : s === "bloqueada" ? "bg-destructive text-destructive-foreground"
  : "bg-muted text-muted-foreground";

export default function Schedule({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const tasks = useQuery({
    queryKey: ["schedule-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task")
        .select("id, project_id, name, description, status, priority, progress, start_date, end_date, assignee_id")
        .eq("project_id", projectId)
        .order("start_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as Task[];
    },
  });

  const members = useQuery({
    queryKey: ["schedule-members", projectId],
    queryFn: async () => {
      const { data: m } = await supabase.from("project_member").select("user_id").eq("project_id", projectId);
      const ids = (m || []).map((x) => x.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, name, email").in("user_id", ids).order("name");
      return profs || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "concluida") patch.progress = 100;
      const { error } = await supabase.from("task").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-tasks", projectId] }),
    onError: (e: any) => toast.error(e.message || "Erro ao mover"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cronograma</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
          <Plus className="h-4 w-4 mr-1" /> Nova tarefa
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="pt-4">
            {tasks.isLoading ? <Skeleton className="h-64" /> : (
              <KanbanView
                tasks={tasks.data || []}
                onMove={(id, status) => updateStatus.mutate({ id, status })}
                onEdit={setEditing}
              />
            )}
          </TabsContent>

          <TabsContent value="lista" className="pt-4">
            {tasks.isLoading ? <Skeleton className="h-64" /> : (
              <ListView tasks={tasks.data || []} onEdit={setEditing} />
            )}
          </TabsContent>

          <TabsContent value="gantt" className="pt-4">
            {tasks.isLoading ? <Skeleton className="h-64" /> : (
              <GanttView tasks={tasks.data || []} onEdit={setEditing} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <TaskDialog
        open={creating || !!editing}
        task={editing}
        projectId={projectId}
        members={members.data || []}
        allTasks={tasks.data || []}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
    </Card>
  );
}

// ============== KANBAN ==============
function KanbanView({
  tasks, onMove, onEdit,
}: {
  tasks: Task[];
  onMove: (id: string, status: string) => void;
  onEdit: (t: Task) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = tasks.find((t) => t.id === activeId);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const tId = String(e.active.id);
    const newStatus = e.over?.id ? String(e.over.id) : null;
    if (!newStatus) return;
    const t = tasks.find((x) => x.id === tId);
    if (!t || t.status === newStatus) return;
    onMove(tId, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STATUS_COLS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return <KanbanCol key={col.id} id={col.id} label={col.label} tasks={colTasks} onEdit={onEdit} />;
        })}
      </div>
      <DragOverlay>
        {active && <KanbanCard task={active} onEdit={() => {}} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanCol({
  id, label, tasks, onEdit,
}: { id: string; label: string; tasks: Task[]; onEdit: (t: Task) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 p-2 min-h-[200px] transition-colors ${
        isOver ? "border-brand-500 bg-brand-500/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs uppercase tracking-wider font-bold">{label}</span>
        <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => <KanbanCard key={t.id} task={t} onEdit={onEdit} />)}
        {!tasks.length && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
      </div>
    </div>
  );
}

function KanbanCard({ task, onEdit, dragging }: { task: Task; onEdit: (t: Task) => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-card border rounded-md p-2.5 shadow-sm cursor-pointer hover:border-brand-500 transition ${
        isDragging || dragging ? "opacity-50" : ""
      }`}
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{task.name}</p>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <Badge className={`${priorityColor(task.priority)} text-[9px] uppercase`}>{task.priority}</Badge>
            {task.end_date && (
              <span className="text-[10px] text-muted-foreground">
                {format(parseISO(task.end_date), "dd/MM")}
              </span>
            )}
          </div>
          {task.progress > 0 && task.status !== "concluida" && (
            <Progress value={task.progress} className="h-1 mt-2" />
          )}
        </div>
      </div>
    </div>
  );
}

// ============== LISTA ==============
function ListView({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma tarefa.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tarefa</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Prioridade</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Fim</TableHead>
          <TableHead>Progresso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => (
          <TableRow key={t.id} className="cursor-pointer" onClick={() => onEdit(t)}>
            <TableCell className="font-medium">{t.name}</TableCell>
            <TableCell><Badge className={`${statusColor(t.status)} text-[10px] uppercase`}>{t.status.replace("_", " ")}</Badge></TableCell>
            <TableCell><Badge className={`${priorityColor(t.priority)} text-[10px] uppercase`}>{t.priority}</Badge></TableCell>
            <TableCell className="text-sm">{t.start_date ? format(parseISO(t.start_date), "dd/MM/yy") : "—"}</TableCell>
            <TableCell className="text-sm">{t.end_date ? format(parseISO(t.end_date), "dd/MM/yy") : "—"}</TableCell>
            <TableCell className="w-32">
              <div className="flex items-center gap-2">
                <Progress value={t.progress} className="h-1.5" />
                <span className="text-xs text-muted-foreground w-8 text-right">{t.progress}%</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============== GANTT ==============
function GanttView({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const dated = useMemo(() => tasks.filter((t) => t.start_date && t.end_date), [tasks]);
  const range = useMemo(() => {
    if (!dated.length) return null;
    const starts = dated.map((t) => parseISO(t.start_date!));
    const ends = dated.map((t) => parseISO(t.end_date!));
    const min = dateMin(starts);
    const max = dateMax(ends);
    const totalDays = Math.max(1, differenceInDays(max, min) + 1);
    return { min, max, totalDays };
  }, [dated]);

  if (!range) return (
    <p className="text-sm text-muted-foreground text-center py-12">
      Nenhuma tarefa com início e fim definidos. Edite as tarefas para visualizar no Gantt.
    </p>
  );

  // Build day headers (cap at 60 cols visually)
  const dayWidth = range.totalDays <= 30 ? 32 : range.totalDays <= 90 ? 14 : 6;
  const totalWidth = range.totalDays * dayWidth;

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 240 + totalWidth }}>
          {/* Header */}
          <div className="flex border-b bg-muted/40 sticky top-0">
            <div className="w-[240px] shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wider border-r">
              Tarefa
            </div>
            <div className="relative" style={{ width: totalWidth }}>
              <div className="flex h-full">
                {Array.from({ length: range.totalDays }).map((_, i) => {
                  const d = addDays(range.min, i);
                  const isMonthStart = d.getDate() === 1 || i === 0;
                  return (
                    <div
                      key={i}
                      style={{ width: dayWidth }}
                      className={`text-[9px] text-center py-1 border-r ${
                        d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/60" : ""
                      }`}
                    >
                      {isMonthStart && (
                        <div className="font-bold uppercase truncate">
                          {format(d, "MMM", { locale: ptBR })}
                        </div>
                      )}
                      {dayWidth >= 14 && <div className="text-muted-foreground">{d.getDate()}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          {dated.map((t) => {
            const start = parseISO(t.start_date!);
            const end = parseISO(t.end_date!);
            const offset = differenceInDays(start, range.min);
            const length = Math.max(1, differenceInDays(end, start) + 1);
            const left = offset * dayWidth;
            const width = length * dayWidth;
            const fillW = (width * (t.progress || 0)) / 100;

            return (
              <div key={t.id} className="flex border-b hover:bg-muted/30 cursor-pointer" onClick={() => onEdit(t)}>
                <div className="w-[240px] shrink-0 px-3 py-2 border-r text-sm truncate">
                  {t.name}
                </div>
                <div className="relative" style={{ width: totalWidth, height: 36 }}>
                  <div
                    className="absolute top-2 h-5 rounded bg-brand-500/30 border border-brand-500/60 overflow-hidden"
                    style={{ left, width }}
                    title={`${format(start, "dd/MM")} → ${format(end, "dd/MM")} (${t.progress}%)`}
                  >
                    <div className="h-full bg-brand-500" style={{ width: fillW }} />
                    {dayWidth >= 14 && (
                      <span className="absolute inset-0 px-2 text-[10px] font-bold text-ink flex items-center">
                        {t.progress}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============== TASK DIALOG ==============
function TaskDialog({
  open, task, projectId, members, allTasks, onClose,
}: {
  open: boolean;
  task: Task | null;
  projectId: string;
  members: { user_id: string; name: string; email: string }[];
  allTasks: Task[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!task;

  const [form, setForm] = useState({
    name: "", description: "", status: "backlog", priority: "media",
    progress: 0, start_date: "", end_date: "", assignee_id: "",
  });

  // Reset form when opening
  useMemo(() => {
    if (open) {
      if (task) {
        setForm({
          name: task.name,
          description: task.description || "",
          status: task.status,
          priority: task.priority,
          progress: task.progress,
          start_date: task.start_date || "",
          end_date: task.end_date || "",
          assignee_id: task.assignee_id || "",
        });
      } else {
        setForm({ name: "", description: "", status: "backlog", priority: "media", progress: 0, start_date: "", end_date: "", assignee_id: "" });
      }
    }
  }, [open, task?.id]);

  // Dependencies
  const deps = useQuery({
    queryKey: ["task-deps", task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_dependency")
        .select("id, predecessor_id, type, lag_days")
        .eq("successor_id", task!.id);
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload: any = {
        project_id: projectId,
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        progress: Number(form.progress) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        assignee_id: form.assignee_id || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("task").update(payload).eq("id", task!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tarefa atualizada" : "Tarefa criada");
      qc.invalidateQueries({ queryKey: ["schedule-tasks", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("task").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarefa removida");
      qc.invalidateQueries({ queryKey: ["schedule-tasks", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const addDep = useMutation({
    mutationFn: async (predecessorId: string) => {
      if (!task) return;
      if (predecessorId === task.id) throw new Error("Tarefa não pode depender de si mesma");
      const { error } = await supabase.from("task_dependency").insert({
        predecessor_id: predecessorId,
        successor_id: task.id,
        project_id: projectId,
        type: "FS",
        lag_days: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dependência adicionada");
      qc.invalidateQueries({ queryKey: ["task-deps", task?.id] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeDep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_dependency").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dependência removida");
      qc.invalidateQueries({ queryKey: ["task-deps", task?.id] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Progresso (%)</Label>
              <Input type="number" min={0} max={100} value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.assignee_id || "none"} onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem responsável —</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dependencies (only when editing) */}
          {isEdit && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Predecessoras (FS)</Label>
              <div className="space-y-1">
                {(deps.data || []).map((d) => {
                  const pred = allTasks.find((t) => t.id === d.predecessor_id);
                  return (
                    <div key={d.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-sm">
                      <span>{pred?.name || d.predecessor_id.slice(0, 8)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDep.mutate(d.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                {!(deps.data || []).length && <p className="text-xs text-muted-foreground">Sem dependências.</p>}
              </div>
              <Select onValueChange={(v) => v && addDep.mutate(v)}>
                <SelectTrigger><SelectValue placeholder="+ Adicionar predecessora" /></SelectTrigger>
                <SelectContent>
                  {allTasks
                    .filter((t) => t.id !== task?.id && !(deps.data || []).some((d) => d.predecessor_id === t.id))
                    .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {isEdit && (
              <Button variant="outline" className="text-destructive" onClick={() => {
                if (confirm("Remover esta tarefa?")) remove.mutate();
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
