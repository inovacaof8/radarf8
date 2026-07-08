import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Link2, Pencil, Calendar, FolderInput,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, addDays, max as dateMax, min as dateMin } from "date-fns";
import { ptBR } from "date-fns/locale";
import { rescheduleProjectDependencies } from "@/lib/scheduleDependencies";

type Deliverable = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  progress: number;
  order_index: number;
};

type Task = {
  id: string;
  project_id: string;
  deliverable_id: string | null;
  name: string;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  baseline_start_date: string | null;
  baseline_end_date: string | null;
  assignee_id: string | null;
  assignee_external_name: string | null;
  order_index: number;
  observations: string | null;
};

type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
};

type Member = { user_id: string; name: string; email: string };

const D_STATUS = [
  { v: "not_started", label: "Não iniciada" },
  { v: "in_progress", label: "Em andamento" },
  { v: "blocked", label: "Bloqueada" },
  { v: "done", label: "Concluída" },
  { v: "cancelled", label: "Cancelada" },
];

const T_STATUS = [
  { v: "backlog", label: "Backlog" },
  { v: "em_andamento", label: "Em andamento" },
  { v: "bloqueada", label: "Bloqueada" },
  { v: "concluida", label: "Concluída" },
  { v: "cancelada", label: "Cancelada" },
];

const PRIORITIES = [
  { v: "baixa", label: "Baixa" },
  { v: "media", label: "Média" },
  { v: "alta", label: "Alta" },
  { v: "critica", label: "Crítica" },
];

const dStatusColor = (s: string) =>
  s === "done" ? "bg-success text-success-foreground"
    : s === "in_progress" ? "bg-brand-500 text-ink"
    : s === "blocked" ? "bg-destructive text-destructive-foreground"
    : s === "cancelled" ? "bg-muted text-muted-foreground line-through"
    : "bg-secondary";

const tStatusColor = (s: string) =>
  s === "concluida" ? "bg-success text-success-foreground"
    : s === "em_andamento" ? "bg-brand-500 text-ink"
    : s === "bloqueada" ? "bg-destructive text-destructive-foreground"
    : s === "cancelada" ? "bg-muted text-muted-foreground line-through"
    : "bg-secondary";

const priorityColor = (p: string) =>
  p === "critica" ? "bg-destructive text-destructive-foreground"
    : p === "alta" ? "bg-warning text-warning-foreground"
    : p === "media" ? "bg-secondary"
    : "bg-muted text-muted-foreground";

export default function ProjectSchedule({
  projectId,
  canManage,
  currentUserId,
}: {
  projectId: string;
  canManage: boolean;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();

  const deliverables = useQuery({
    queryKey: ["deliverables", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_deliverable")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Deliverable[];
    },
  });

  const tasks = useQuery({
    queryKey: ["sched-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task")
        .select("id, project_id, deliverable_id, name, title, description, status, priority, progress, start_date, end_date, baseline_start_date, baseline_end_date, assignee_id, assignee_external_name, order_index, observations")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Task[];
    },
  });

  const members = useQuery({
    queryKey: ["sched-members", projectId],
    queryFn: async () => {
      const { data: m } = await supabase.from("project_member").select("user_id").eq("project_id", projectId);
      const ids = (m || []).map((x) => x.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, name, email").in("user_id", ids).order("name");
      return (data || []) as Member[];
    },
  });

  const [editingDeliv, setEditingDeliv] = useState<Deliverable | null>(null);
  const [creatingDeliv, setCreatingDeliv] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingTaskFor, setCreatingTaskFor] = useState<string | null | "_none">(null);

  // member can update only own task (progress/status)
  const canEditTask = (t: Task) => canManage || (currentUserId && t.assignee_id === currentUserId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cronograma</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setCreatingDeliv(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
            <Plus className="h-4 w-4 mr-1" /> Macro entrega
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="pt-4">
            {deliverables.isLoading || tasks.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <ListView
                deliverables={deliverables.data || []}
                tasks={tasks.data || []}
                members={members.data || []}
                canManage={canManage}
                canEditTask={canEditTask}
                onEditDeliv={setEditingDeliv}
                onAddTask={(dId) => setCreatingTaskFor(dId)}
                onEditTask={setEditingTask}
              />
            )}
          </TabsContent>

          <TabsContent value="gantt" className="pt-4">
            {deliverables.isLoading || tasks.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <GanttView
                deliverables={deliverables.data || []}
                tasks={tasks.data || []}
                members={members.data || []}
                onEditTask={setEditingTask}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <DeliverableDialog
        open={creatingDeliv || !!editingDeliv}
        deliverable={editingDeliv}
        projectId={projectId}
        members={members.data || []}
        onClose={() => { setCreatingDeliv(false); setEditingDeliv(null); }}
      />

      <TaskDialog
        open={!!creatingTaskFor || !!editingTask}
        task={editingTask}
        defaultDeliverableId={creatingTaskFor && creatingTaskFor !== "_none" ? creatingTaskFor : null}
        projectId={projectId}
        members={members.data || []}
        allTasks={tasks.data || []}
        deliverables={deliverables.data || []}
        readOnly={!!editingTask && !canManage && (editingTask.assignee_id !== currentUserId)}
        memberOnly={!canManage}
        onClose={() => { setCreatingTaskFor(null); setEditingTask(null); }}
      />
    </Card>
  );
}

// ============== LIST VIEW ==============
function ListView({
  deliverables, tasks, members, canManage, canEditTask, onEditDeliv, onAddTask, onEditTask,
}: {
  deliverables: Deliverable[];
  tasks: Task[];
  members: Member[];
  canManage: boolean;
  canEditTask: (t: Task) => any;
  onEditDeliv: (d: Deliverable) => void;
  onAddTask: (dId: string | "_none") => void;
  onEditTask: (t: Task) => void;
}) {
  const orphanTasks = tasks.filter((t) => !t.deliverable_id);

  if (!deliverables.length && !tasks.length) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma macro entrega cadastrada.</p>;
  }

  const qc = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorderDeliv = useMutation({
    mutationFn: async (ordered: Deliverable[]) => {
      const projectId = ordered[0]?.project_id;
      const updates = ordered.map((d, i) =>
        supabase.from("project_deliverable").update({ order_index: i }).eq("id", d.id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      return projectId;
    },
    onSuccess: (projectId) => {
      if (projectId) qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reordenar"),
  });

  const handleDelivDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = deliverables.findIndex((d) => d.id === active.id);
    const newIndex = deliverables.findIndex((d) => d.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderDeliv.mutate(arrayMove(deliverables, oldIndex, newIndex));
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDelivDragEnd}>
        <SortableContext items={deliverables.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deliverables.map((d) => {
            const dTasks = tasks.filter((t) => t.deliverable_id === d.id);
            const computedProgress = dTasks.length
              ? Math.round(dTasks.reduce((s, t) => s + (t.progress || 0), 0) / dTasks.length)
              : d.progress;
            return (
              <DeliverableRow
                key={d.id}
                deliv={d}
                tasks={dTasks}
                members={members}
                allDeliverables={deliverables}
                computedProgress={computedProgress}
                canManage={canManage}
                canEditTask={canEditTask}
                onEdit={() => onEditDeliv(d)}
                onAddTask={() => onAddTask(d.id)}
                onEditTask={onEditTask}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      {orphanTasks.length > 0 && (
        <div className="border rounded-lg">
          <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between">
            <span className="text-sm font-bold">Sem macro entrega</span>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => onAddTask("_none")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Atividade
              </Button>
            )}
          </div>
          <TasksTable tasks={orphanTasks} members={members} allDeliverables={deliverables} canManage={canManage} canEditTask={canEditTask} onEditTask={onEditTask} />
        </div>
      )}
    </div>
  );
}

function DeliverableRow({
  deliv, tasks, members, allDeliverables, computedProgress, canManage, canEditTask, onEdit, onAddTask, onEditTask,
}: {
  deliv: Deliverable;
  tasks: Task[];
  members: Member[];
  allDeliverables: Deliverable[];
  computedProgress: number;
  canManage: boolean;
  canEditTask: (t: Task) => any;
  onEdit: () => void;
  onAddTask: () => void;
  onEditTask: (t: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const owner = members.find((m) => m.user_id === deliv.owner_id);
  const sortable = useSortable({ id: deliv.id, disabled: !canManage });
  const style = canManage
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div ref={canManage ? sortable.setNodeRef : undefined} style={style} className="border rounded-lg">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2">
        {canManage && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => setOpen(!open)} className="text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate">{deliv.title}</span>
            <Badge className={`${dStatusColor(deliv.status)} text-[10px] uppercase`}>
              {D_STATUS.find((s) => s.v === deliv.status)?.label || deliv.status}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{tasks.length} ativ.</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            {owner && <span>Resp.: {owner.name}</span>}
            {deliv.start_date && <span>Início: {format(parseISO(deliv.start_date), "dd/MM/yy")}</span>}
            {deliv.end_date && <span>Fim: {format(parseISO(deliv.end_date), "dd/MM/yy")}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24">
            <Progress value={computedProgress} className="h-1.5" />
            <span className="text-[10px] text-muted-foreground">{computedProgress}%</span>
          </div>
          {canManage && (
            <>
              <Button size="sm" variant="ghost" onClick={onAddTask}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Atividade
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {open && (
        tasks.length === 0
          ? <p className="px-4 py-4 text-xs text-muted-foreground">Nenhuma atividade cadastrada.</p>
          : <TasksTable tasks={tasks} members={members} allDeliverables={allDeliverables} canManage={canManage} canEditTask={canEditTask} onEditTask={onEditTask} />
      )}
    </div>
  );
}

function TasksTable({
  tasks, members, allDeliverables, canManage, canEditTask, onEditTask,
}: {
  tasks: Task[];
  members: Member[];
  allDeliverables: Deliverable[];
  canManage: boolean;
  canEditTask: (t: Task) => any;
  onEditTask: (t: Task) => void;
}) {
  const qc = useQueryClient();
  const sorted = [...tasks].sort((a, b) => {
    const oa = a.order_index ?? 0;
    const ob = b.order_index ?? 0;
    if (oa !== ob) return oa - ob;
    const da = a.start_date || a.end_date || "";
    const db = b.start_date || b.end_date || "";
    return da.localeCompare(db);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reorder = useMutation({
    mutationFn: async (ordered: Task[]) => {
      const updates = ordered.map((t, i) =>
        supabase.from("task").update({ order_index: i }).eq("id", t.id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-tasks"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reordenar"),
  });

  const moveDeliv = useMutation({
    mutationFn: async ({ taskId, deliverableId }: { taskId: string; deliverableId: string | null }) => {
      const { error } = await supabase.from("task").update({ deliverable_id: deliverableId }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-tasks"] });
      toast.success("Atividade movida");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao mover"),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((t) => t.id === active.id);
    const newIndex = sorted.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(sorted, oldIndex, newIndex);
    reorder.mutate(next);
  };

  const renderRow = (t: Task) => {
    const ass = members.find((m) => m.user_id === t.assignee_id);
    const assigneeLabel = ass?.name || t.assignee_external_name;
    const editable = canEditTask(t);
    return (
      <TaskRow
        key={t.id}
        task={t}
        draggable={canManage}
        editable={!!editable}
        canManage={canManage}
        allDeliverables={allDeliverables}
        onMoveDeliv={(did) => moveDeliv.mutate({ taskId: t.id, deliverableId: did })}
        assigneeLabel={assigneeLabel}
        onEdit={() => editable && onEditTask(t)}
      />
    );
  };

  return (
    <div className="divide-y">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((t) => renderRow(t))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TaskRow({
  task: t, draggable, editable, canManage, allDeliverables, onMoveDeliv, assigneeLabel, onEdit,
}: {
  task: Task;
  draggable: boolean;
  editable: boolean;
  canManage: boolean;
  allDeliverables: Deliverable[];
  onMoveDeliv: (deliverableId: string | null) => void;
  assigneeLabel: string | null | undefined;
  onEdit: () => void;
}) {
  const sortable = useSortable({ id: t.id, disabled: !draggable });
  const style = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={draggable ? sortable.setNodeRef : undefined}
      style={style}
      className={`px-3 py-2 flex items-center gap-2 text-sm ${editable ? "cursor-pointer hover:bg-muted/30" : ""}`}
      onClick={onEdit}
    >
      {draggable && (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{t.title || t.name}</span>
          <Badge className={`${tStatusColor(t.status)} text-[9px] uppercase`}>{t.status.replace("_", " ")}</Badge>
          <Badge className={`${priorityColor(t.priority)} text-[9px] uppercase`}>{t.priority}</Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
          {assigneeLabel && <span>{assigneeLabel}</span>}
          {t.start_date && <span>{format(parseISO(t.start_date), "dd/MM/yy")}</span>}
          {t.end_date && <span>→ {format(parseISO(t.end_date), "dd/MM/yy")}</span>}
        </div>
      </div>
      <div className="w-24">
        <Progress value={t.progress} className="h-1.5" />
        <span className="text-[10px] text-muted-foreground">{t.progress}%</span>
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
              title="Mover para outra macro entrega"
            >
              <FolderInput className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!t.deliverable_id}
              onClick={() => onMoveDeliv(null)}
            >
              — Sem macro entrega —
            </DropdownMenuItem>
            {allDeliverables.map((d) => (
              <DropdownMenuItem
                key={d.id}
                disabled={d.id === t.deliverable_id}
                onClick={() => onMoveDeliv(d.id)}
              >
                {d.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ============== GANTT ==============
function GanttView({
  deliverables, tasks, members, onEditTask,
}: {
  deliverables: Deliverable[];
  tasks: Task[];
  members: Member[];
  onEditTask: (t: Task) => void;
}) {
  type Row = { kind: "deliv" | "task" | "section"; id: string; label: string; start?: Date; end?: Date; progress?: number; status?: string; assignee?: string; task?: Task; };

  // Build rows in order: deliverable -> its tasks; sem macro; sem datas (sem barra)
  const datedTasks = tasks.filter((t) => t.start_date && t.end_date);
  const undatedTasks = tasks.filter((t) => !t.start_date || !t.end_date);

  const rows: Row[] = [];
  for (const d of deliverables) {
    const start = d.start_date ? parseISO(d.start_date) : undefined;
    const end = d.end_date ? parseISO(d.end_date) : undefined;
    rows.push({ kind: "deliv", id: d.id, label: d.title, start, end, progress: d.progress, status: d.status });
    const dTasks = datedTasks.filter((t) => t.deliverable_id === d.id);
    for (const t of dTasks) {
      rows.push({
        kind: "task", id: t.id, label: t.title || t.name,
        start: parseISO(t.start_date!), end: parseISO(t.end_date!),
        progress: t.progress, status: t.status,
        assignee: members.find((m) => m.user_id === t.assignee_id)?.name || t.assignee_external_name || undefined,
        task: t,
      });
    }
  }
  const orphanDated = datedTasks.filter((t) => !t.deliverable_id);
  if (orphanDated.length) {
    rows.push({ kind: "section", id: "_no_deliv", label: "Sem macro entrega" });
    for (const t of orphanDated) {
      rows.push({
        kind: "task", id: t.id, label: t.title || t.name,
        start: parseISO(t.start_date!), end: parseISO(t.end_date!),
        progress: t.progress, status: t.status,
        assignee: members.find((m) => m.user_id === t.assignee_id)?.name || t.assignee_external_name || undefined,
        task: t,
      });
    }
  }

  // compute date range from any rows that have dates
  const allDates: Date[] = [];
  rows.forEach((r) => { if (r.start) allDates.push(r.start); if (r.end) allDates.push(r.end); });
  if (!allDates.length && undatedTasks.length === 0 && deliverables.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nenhuma atividade com datas para exibir no Gantt.</p>;
  }

  const range = allDates.length
    ? { min: dateMin(allDates), max: dateMax(allDates), totalDays: 0 }
    : null;
  if (range) range.totalDays = Math.max(1, differenceInDays(range.max, range.min) + 1);

  const dayWidth = !range ? 0 : range.totalDays <= 30 ? 32 : range.totalDays <= 90 ? 14 : 6;
  const totalWidth = range ? range.totalDays * dayWidth : 0;

  return (
    <div className="space-y-4">
      {range && (
        <div className="border rounded-md overflow-hidden" data-gantt-export>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 320 + totalWidth }}>
              {/* header */}
              <div className="flex border-b bg-muted/40 sticky top-0 z-10">
                <div className="w-[320px] shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wider border-r">
                  Atividade
                </div>
                <div style={{ width: totalWidth }} className="flex">
                  {Array.from({ length: range.totalDays }).map((_, i) => {
                    const d = addDays(range.min, i);
                    const isMonthStart = d.getDate() === 1 || i === 0;
                    return (
                      <div key={i} style={{ width: dayWidth }}
                        className={`text-[9px] text-center py-1 border-r ${d.getDay() === 0 || d.getDay() === 6 ? "bg-muted/60" : ""}`}>
                        {isMonthStart && <div className="font-bold uppercase truncate">{format(d, "MMM/yy", { locale: ptBR })}</div>}
                        {dayWidth >= 14 && <div className="text-muted-foreground">{d.getDate()}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {rows.map((r) => {
                if (r.kind === "section") {
                  return (
                    <div key={r.id} className="flex border-b bg-muted/30">
                      <div className="w-[320px] shrink-0 px-3 py-1.5 text-xs font-bold border-r">{r.label}</div>
                      <div style={{ width: totalWidth }} />
                    </div>
                  );
                }
                const hasBar = r.start && r.end;
                const offset = hasBar ? differenceInDays(r.start!, range.min) : 0;
                const length = hasBar ? Math.max(1, differenceInDays(r.end!, r.start!) + 1) : 0;
                const left = offset * dayWidth;
                const width = length * dayWidth;
                const fillW = (width * (r.progress || 0)) / 100;

                const isDeliv = r.kind === "deliv";
                const labelClass = isDeliv ? "font-bold" : "pl-6";
                const barColor = isDeliv ? "bg-foreground/70 border-foreground" : "bg-brand-500/30 border-brand-500/60";
                const fillColor = isDeliv ? "bg-foreground" : "bg-brand-500";

                return (
                  <div key={r.id}
                    className={`flex border-b ${r.task ? "hover:bg-muted/30 cursor-pointer" : ""}`}
                    onClick={() => r.task && onEditTask(r.task)}>
                    <div className={`w-[320px] shrink-0 px-3 py-2 border-r text-sm truncate ${labelClass}`}>
                      <div className="truncate">{r.label}</div>
                      {r.assignee && <div className="text-[10px] text-muted-foreground truncate">{r.assignee}</div>}
                    </div>
                    <div className="relative" style={{ width: totalWidth, height: isDeliv ? 32 : 38 }}>
                      {hasBar && (
                        <div
                          className={`absolute top-1.5 ${isDeliv ? "h-3" : "h-5"} rounded border ${barColor} overflow-hidden`}
                          style={{ left, width }}
                          title={`${format(r.start!, "dd/MM/yy")} → ${format(r.end!, "dd/MM/yy")} • ${r.progress || 0}%`}
                        >
                          <div className={`h-full ${fillColor}`} style={{ width: fillW }} />
                          {!isDeliv && dayWidth >= 14 && (
                            <span className="absolute inset-0 px-2 text-[10px] font-bold text-ink flex items-center">
                              {r.progress || 0}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {undatedTasks.length > 0 && (
        <div className="border rounded-md">
          <div className="px-3 py-2 bg-muted/40 border-b text-xs font-bold uppercase">Sem datas definidas</div>
          <div className="divide-y">
            {undatedTasks.map((t) => (
              <div key={t.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-muted/30" onClick={() => onEditTask(t)}>
                {t.title || t.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== DELIVERABLE DIALOG ==============
function DeliverableDialog({
  open, deliverable, projectId, members, onClose,
}: {
  open: boolean;
  deliverable: Deliverable | null;
  projectId: string;
  members: Member[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!deliverable;
  const [form, setForm] = useState({
    title: "", description: "", owner_id: "", start_date: "", end_date: "",
    status: "not_started", progress: 0,
  });

  useMemo(() => {
    if (open) {
      if (deliverable) {
        setForm({
          title: deliverable.title,
          description: deliverable.description || "",
          owner_id: deliverable.owner_id || "",
          start_date: deliverable.start_date || "",
          end_date: deliverable.end_date || "",
          status: deliverable.status,
          progress: deliverable.progress,
        });
      } else {
        setForm({ title: "", description: "", owner_id: "", start_date: "", end_date: "", status: "not_started", progress: 0 });
      }
    }
  }, [open, deliverable?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título é obrigatório");
      if (form.start_date && form.end_date && form.start_date > form.end_date)
        throw new Error("Início não pode ser maior que o fim");
      const payload: any = {
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        owner_id: form.owner_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
      };
      if (isEdit) {
        const { error } = await supabase.from("project_deliverable").update(payload).eq("id", deliverable!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_deliverable").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(isEdit ? "Macro entrega atualizada" : "Macro entrega criada");
      await qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
      await qc.refetchQueries({ queryKey: ["deliverables", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!deliverable) return;
      const { error } = await supabase.from("project_deliverable").delete().eq("id", deliverable.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Macro entrega removida");
      qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
      qc.invalidateQueries({ queryKey: ["sched-tasks", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar macro entrega" : "Nova macro entrega"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.owner_id || "none"} onValueChange={(v) => setForm({ ...form, owner_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem responsável —</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {D_STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
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
          <div className="space-y-2">
            <Label>Progresso (%)</Label>
            <Input type="number" min={0} max={100} value={form.progress}
              onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {isEdit && (
              <Button variant="outline" className="text-destructive" onClick={() => {
                if (confirm("Remover esta macro entrega? As atividades vinculadas serão desvinculadas.")) remove.mutate();
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              disabled={save.isPending} onClick={() => save.mutate()}>
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== TASK DIALOG (com dependências) ==============
function TaskDialog({
  open, task, defaultDeliverableId, projectId, members, allTasks, deliverables, readOnly, memberOnly, onClose,
}: {
  open: boolean;
  task: Task | null;
  defaultDeliverableId: string | null;
  projectId: string;
  members: Member[];
  allTasks: Task[];
  deliverables: Deliverable[];
  readOnly: boolean;
  memberOnly: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: "", description: "", deliverable_id: "",
    status: "backlog", priority: "media", progress: 0,
    start_date: "", end_date: "", baseline_start_date: "", baseline_end_date: "",
    assignee_id: "", assignee_external_name: "", observations: "",
  });

  useMemo(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title || task.name || "",
          description: task.description || "",
          deliverable_id: task.deliverable_id || "",
          status: task.status,
          priority: task.priority,
          progress: task.progress,
          start_date: task.start_date || "",
          end_date: task.end_date || "",
          baseline_start_date: task.baseline_start_date || "",
          baseline_end_date: task.baseline_end_date || "",
          assignee_id: task.assignee_id || "",
          assignee_external_name: task.assignee_external_name || "",
          observations: task.observations || "",
        });
      } else {
        setForm({
          title: "", description: "", deliverable_id: defaultDeliverableId || "",
          status: "backlog", priority: "media", progress: 0,
          start_date: "", end_date: "", baseline_start_date: "", baseline_end_date: "",
          assignee_id: "", assignee_external_name: "", observations: "",
        });
      }
    }
  }, [open, task?.id, defaultDeliverableId]);

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
      if (!form.title.trim()) throw new Error("Título é obrigatório");
      if (form.start_date && form.end_date && form.start_date > form.end_date)
        throw new Error("Início não pode ser maior que o fim");
      const fullPayload: any = {
        project_id: projectId,
        deliverable_id: form.deliverable_id || null,
        title: form.title.trim(),
        name: form.title.trim(),
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        baseline_start_date: form.baseline_start_date || null,
        baseline_end_date: form.baseline_end_date || null,
        assignee_id: form.assignee_id || null,
        assignee_external_name: form.assignee_id ? null : (form.assignee_external_name.trim() || null),
        observations: form.observations.trim() || null,
      };
      // Member only updates progress + status + observations of own task
      const memberPayload: any = {
        progress: fullPayload.progress,
        status: fullPayload.status,
        observations: fullPayload.observations,
      };
      const payload = memberOnly && isEdit ? memberPayload : fullPayload;

      if (isEdit) {
        const { error } = await supabase.from("task").update(payload).eq("id", task!.id);
        if (error) throw error;
      } else {
        const { data: maxRow } = await supabase
          .from("task")
          .select("order_index")
          .eq("project_id", projectId)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle();
        fullPayload.order_index = ((maxRow?.order_index ?? -1) as number) + 1;
        const { error } = await supabase.from("task").insert(fullPayload);
        if (error) throw error;
      }
      // Recalculate dependent tasks' dates based on business-day rules
      try { await rescheduleProjectDependencies(projectId); } catch (e) { console.error(e); }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Atividade atualizada" : "Atividade criada");
      qc.invalidateQueries({ queryKey: ["sched-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["project-progress", projectId] });
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
      toast.success("Atividade removida");
      qc.invalidateQueries({ queryKey: ["sched-tasks", projectId] });
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
      try { await rescheduleProjectDependencies(projectId); } catch (e) { console.error(e); }
    },
    onSuccess: () => {
      toast.success("Dependência adicionada");
      qc.invalidateQueries({ queryKey: ["task-deps", task?.id] });
      qc.invalidateQueries({ queryKey: ["sched-tasks", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar dependência"),
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

  const disabled = readOnly;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar atividade" : "Nova atividade"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input disabled={disabled || memberOnly} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea disabled={disabled || memberOnly} rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Macro entrega</Label>
              <Select disabled={disabled || memberOnly}
                value={form.deliverable_id || "none"}
                onValueChange={(v) => setForm({ ...form, deliverable_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem macro entrega —</SelectItem>
                  {deliverables.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select disabled={disabled || memberOnly}
                value={form.assignee_id || "none"}
                onValueChange={(v) => setForm({ ...form, assignee_id: v === "none" ? "" : v, assignee_external_name: v === "none" ? form.assignee_external_name : "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem responsável (ou externo) —</SelectItem>
                  {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!form.assignee_id && (
                <Input
                  disabled={disabled || memberOnly}
                  placeholder="Responsável externo (nome livre)"
                  value={form.assignee_external_name}
                  onChange={(e) => setForm({ ...form, assignee_external_name: e.target.value })}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select disabled={disabled} value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {T_STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select disabled={disabled || memberOnly} value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
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
              <Input disabled={disabled || memberOnly} type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input disabled={disabled || memberOnly} type="date" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Baseline início</Label>
              <Input disabled={disabled || memberOnly} type="date" value={form.baseline_start_date}
                onChange={(e) => setForm({ ...form, baseline_start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Baseline fim</Label>
              <Input disabled={disabled || memberOnly} type="date" value={form.baseline_end_date}
                onChange={(e) => setForm({ ...form, baseline_end_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Progresso (%)</Label>
            <Input disabled={disabled} type="number" min={0} max={100} value={form.progress}
              onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
          </div>

          {/* Dependências */}
          {isEdit && !memberOnly && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Dependências (predecessoras)</Label>
              <div className="space-y-1">
                {(deps.data || []).map((d) => {
                  const pred = allTasks.find((t) => t.id === d.predecessor_id);
                  return (
                    <div key={d.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-sm">
                      <span>{pred?.title || pred?.name || d.predecessor_id.slice(0, 8)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDep.mutate(d.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                {!(deps.data || []).length && <p className="text-xs text-muted-foreground">Nenhuma dependência cadastrada.</p>}
              </div>
              <Select onValueChange={(v) => v && addDep.mutate(v)}>
                <SelectTrigger><SelectValue placeholder="+ Adicionar predecessora" /></SelectTrigger>
                <SelectContent>
                  {allTasks
                    .filter((t) => t.id !== task?.id && !(deps.data || []).some((d) => d.predecessor_id === t.id))
                    .map((t) => <SelectItem key={t.id} value={t.id}>{t.title || t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              placeholder="Notas do responsável, andamento, impedimentos..."
              disabled={disabled}
            />
          </div>

          {isEdit && task && (
            <TaskAttachmentsPanel taskId={task.id} canUpload={!disabled} />
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {isEdit && !memberOnly && (
              <Button variant="outline" className="text-destructive" onClick={() => {
                if (confirm("Remover esta atividade?")) remove.mutate();
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              disabled={save.isPending || disabled} onClick={() => save.mutate()}>
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskAttachmentsPanel({ taskId, canUpload }: { taskId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const attachments = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachment")
        .select("id, task_id, file_name, file_path, mime_type, size_bytes, uploaded_by, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TaskAttachment[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Não autenticado");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${taskId}/${Date.now()}_${safeName}`;
      const up = await supabase.storage.from("task-attachments").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("task_attachment").insert({
        task_id: taskId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: uid,
      });
      if (error) {
        await supabase.storage.from("task-attachments").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Evidência anexada");
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro no upload"),
  });

  const remove = useMutation({
    mutationFn: async (a: TaskAttachment) => {
      const { error } = await supabase.from("task_attachment").delete().eq("id", a.id);
      if (error) throw error;
      await supabase.storage.from("task-attachments").remove([a.file_path]);
    },
    onSuccess: () => {
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const download = async (a: TaskAttachment) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(a.file_path, 60);
    if (error || !data) { toast.error("Não foi possível gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center justify-between">
        <Label>Evidências (anexos)</Label>
        {canUpload && (
          <label className="inline-flex items-center gap-1 text-xs text-brand-600 cursor-pointer hover:underline">
            <Plus className="h-3.5 w-3.5" />
            <span>{upload.isPending ? "Enviando..." : "Adicionar arquivo"}</span>
            <input
              type="file"
              className="hidden"
              disabled={upload.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>
      {attachments.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (attachments.data || []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma evidência anexada.</p>
      ) : (
        <div className="space-y-1">
          {(attachments.data || []).map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1 text-sm">
              <button type="button" onClick={() => download(a)} className="truncate text-left hover:underline flex-1">
                {a.file_name}
                {a.size_bytes ? <span className="text-xs text-muted-foreground ml-2">({Math.round(a.size_bytes / 1024)} KB)</span> : null}
              </button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (confirm("Remover anexo?")) remove.mutate(a); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
