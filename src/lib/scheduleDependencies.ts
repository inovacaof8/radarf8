import { supabase } from "@/integrations/supabase/client";
import { addBusinessDays, isBusinessDay, nextBusinessDay, parseISODate, toISODate } from "./businessDays";
import { addDays, differenceInCalendarDays } from "date-fns";

type TaskRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
};
type DepRow = {
  predecessor_id: string;
  successor_id: string;
  lag_days: number | null;
  type: string | null;
};

/**
 * Recalculates start/end dates of dependent tasks so that a successor begins on the
 * next business day after its predecessor's end_date (+ lag business days).
 * - Preserves each task's calendar-day duration.
 * - Cascades through the dependency graph (topologically).
 * - Considers Brazilian national holidays + weekends as non-business days.
 */
export async function rescheduleProjectDependencies(projectId: string): Promise<void> {
  const { data: tasksData, error: tErr } = await supabase
    .from("task")
    .select("id, start_date, end_date, status")
    .eq("project_id", projectId);
  if (tErr) throw tErr;
  const tasks = (tasksData || []) as TaskRow[];
  const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));

  const { data: depsData, error: dErr } = await supabase
    .from("task_dependency")
    .select("predecessor_id, successor_id, lag_days, type")
    .eq("project_id", projectId);
  if (dErr) throw dErr;
  const deps = (depsData || []) as DepRow[];

  // Build adjacency
  const predsOf = new Map<string, DepRow[]>();
  const succsOf = new Map<string, DepRow[]>();
  for (const d of deps) {
    if (!predsOf.has(d.successor_id)) predsOf.set(d.successor_id, []);
    predsOf.get(d.successor_id)!.push(d);
    if (!succsOf.has(d.predecessor_id)) succsOf.set(d.predecessor_id, []);
    succsOf.get(d.predecessor_id)!.push(d);
  }

  // Topological order (Kahn)
  const indeg = new Map<string, number>();
  for (const t of tasks) indeg.set(t.id, (predsOf.get(t.id) || []).length);
  const queue: string[] = [];
  indeg.forEach((v, k) => { if (v === 0) queue.push(k); });
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of succsOf.get(id) || []) {
      indeg.set(s.successor_id, (indeg.get(s.successor_id) || 1) - 1);
      if (indeg.get(s.successor_id) === 0) queue.push(s.successor_id);
    }
  }

  const updates: Array<{ id: string; start_date: string; end_date: string | null }> = [];

  for (const id of order) {
    const task = taskMap.get(id);
    if (!task) continue;
    const preds = predsOf.get(id) || [];
    if (preds.length === 0) continue;

    // Find latest required start
    let latestStart: Date | null = null;
    for (const p of preds) {
      const pred = taskMap.get(p.predecessor_id);
      if (!pred?.end_date) continue;
      let candidate = nextBusinessDay(parseISODate(pred.end_date));
      const lag = p.lag_days || 0;
      if (lag > 0) candidate = addBusinessDays(candidate, lag);
      if (!latestStart || candidate > latestStart) latestStart = candidate;
    }
    if (!latestStart) continue;

    // Preserve duration only if the task had both dates originally
    const hadDuration = !!(task.start_date && task.end_date);
    const durationDays = hadDuration
      ? Math.max(0, differenceInCalendarDays(parseISODate(task.end_date!), parseISODate(task.start_date!)))
      : null;

    const newStart = latestStart;
    const newStartISO = toISODate(newStart);
    const newEndISO = durationDays !== null ? toISODate(addDays(newStart, durationDays)) : null;

    if (task.start_date !== newStartISO || task.end_date !== newEndISO) {
      task.start_date = newStartISO;
      task.end_date = newEndISO;
      updates.push({ id: task.id, start_date: newStartISO, end_date: newEndISO });
    }
  }

  // Apply updates sequentially (small N in practice)
  for (const u of updates) {
    const { error } = await supabase
      .from("task")
      .update({ start_date: u.start_date, end_date: u.end_date })
      .eq("id", u.id);
    if (error) throw error;
  }
}
