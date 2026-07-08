import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TeamFiltersBar, EMPTY_FILTERS, type TeamFiltersValue } from "@/components/filters/TeamFiltersBar";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";

type ActionPlan = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  objective: string | null;
  justification: string | null;
  origin_type: string;
  origin_id: string | null;
  status: string;
  priority: string;
  progress: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  owner_id: string | null;
  created_by: string | null;
};

const STATUS = ["Rascunho","Em andamento","Concluído","Cancelado","Suspenso","Reaberto"];
const PRIORITY = ["Baixa","Média","Alta","Crítica"];
const ORIGIN = [
  { v: "manual", l: "Manual" },
  { v: "meeting", l: "Reunião" },
  { v: "project", l: "Projeto" },
  { v: "audit", l: "Auditoria" },
  { v: "risk", l: "Risco" },
  { v: "incident", l: "Incidente" },
  { v: "other", l: "Outro" },
];

const statusColor: Record<string, string> = {
  "Rascunho": "bg-muted text-muted-foreground",
  "Em andamento": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Concluído": "bg-green-500/15 text-green-700 dark:text-green-300",
  "Cancelado": "bg-red-500/15 text-red-700 dark:text-red-300",
  "Suspenso": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  "Reaberto": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

const priorityColor: Record<string, string> = {
  "Baixa": "bg-muted text-muted-foreground",
  "Média": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Alta": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Crítica": "bg-red-500/15 text-red-700 dark:text-red-300",
};

const emptyPlan: Partial<ActionPlan> = {
  title: "",
  description: "",
  objective: "",
  justification: "",
  origin_type: "manual",
  status: "Rascunho",
  priority: "Média",
  progress: 0,
};

async function autoPopulatePlan(planId: string, creatorId: string) {
  try {
    // Áreas do criador: principal + áreas gerenciadas + áreas em que participa
    const [{ data: profile }, { data: managed }, { data: memberships }] = await Promise.all([
      supabase.from("profiles").select("primary_area_id").eq("user_id", creatorId).maybeSingle(),
      supabase.rpc("user_managed_areas", { _user_id: creatorId }),
      supabase.from("user_area_membership").select("area_id").eq("user_id", creatorId).eq("status", "active"),
    ]);
    const primaryAreaId = profile?.primary_area_id || null;
    const areaSet = new Set<string>();
    if (primaryAreaId) areaSet.add(primaryAreaId);
    (managed || []).forEach((m: any) => areaSet.add(m.area_id));
    (memberships || []).forEach((m: any) => areaSet.add(m.area_id));
    const areaIds = Array.from(areaSet);

    if (areaIds.length > 0) {
      await supabase.from("action_plan_area").insert(
        areaIds.map((aid) => ({ action_plan_id: planId, area_id: aid, is_primary: aid === primaryAreaId }))
      );
    }

    // Sempre garante o criador como owner
    const memberRows: any[] = [{ action_plan_id: planId, user_id: creatorId, role_in_plan: "owner" }];

    if (areaIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      // Membros ativos das áreas como participantes
      const { data: members } = await supabase
        .from("user_area_membership")
        .select("user_id")
        .in("area_id", areaIds)
        .eq("status", "active");
      const uniqueMembers = new Set<string>((members || []).map((m: any) => m.user_id));
      uniqueMembers.delete(creatorId);
      uniqueMembers.forEach((uid) =>
        memberRows.push({ action_plan_id: planId, user_id: uid, role_in_plan: "participant" })
      );

      // Gestores das áreas como validadores
      const { data: managers } = await supabase
        .from("area_manager")
        .select("user_id, end_date")
        .in("area_id", areaIds)
        .eq("status", "active")
        .lte("start_date", today);
      const validatorIds = new Set<string>(
        (managers || [])
          .filter((m: any) => !m.end_date || m.end_date >= today)
          .map((m: any) => m.user_id)
      );
      validatorIds.delete(creatorId);
      validatorIds.forEach((uid) =>
        memberRows.push({ action_plan_id: planId, user_id: uid, role_in_plan: "validator" })
      );
    }

    // Deduplicar por (user_id, role_in_plan) e inserir
    const seen = new Set<string>();
    const dedup = memberRows.filter((r) => {
      const k = `${r.user_id}::${r.role_in_plan}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (dedup.length > 0) {
      await supabase.from("action_plan_member").insert(dedup);
    }
  } catch (e) {
    console.error("autoPopulatePlan failed", e);
  }
}

export default function ActionPlansPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = usePersistedFilters<TeamFiltersValue>("action-plans", EMPTY_FILTERS);
  const [editing, setEditing] = useState<Partial<ActionPlan> | null>(null);
  const [toDelete, setToDelete] = useState<ActionPlan | null>(null);

  const list = useQuery({
    queryKey: ["action_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ActionPlan[];
    },
  });

  const planAreas = useQuery({
    queryKey: ["action_plan_areas_map"],
    queryFn: async () => {
      const { data } = await supabase.from("action_plan_area").select("action_plan_id, area_id");
      const map = new Map<string, Set<string>>();
      (data || []).forEach((r: any) => {
        if (!map.has(r.action_plan_id)) map.set(r.action_plan_id, new Set());
        map.get(r.action_plan_id)!.add(r.area_id);
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const items = list.data || [];
    const areasMap = planAreas.data || new Map<string, Set<string>>();
    return items.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const matchText =
          p.title.toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q);
        if (!matchText) return false;
      }
      if (filters.statuses.length && !filters.statuses.includes(p.status)) return false;
      if (filters.priorities.length && !filters.priorities.includes(p.priority)) return false;
      if (filters.personIds.length) {
        const hit = [p.owner_id, p.created_by].some((id) => id && filters.personIds.includes(id));
        if (!hit) return false;
      }
      if (filters.areaIds.length) {
        const set = areasMap.get(p.id);
        if (!set || !filters.areaIds.some((a) => set.has(a))) return false;
      }
      if (filters.period.from && (!p.planned_end_date || p.planned_end_date < filters.period.from)) return false;
      if (filters.period.to && (!p.planned_end_date || p.planned_end_date > filters.period.to)) return false;
      return true;
    });
  }, [list.data, planAreas.data, search, filters]);

  const save = useMutation({
    mutationFn: async (p: Partial<ActionPlan>) => {
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await supabase.from("action_plan").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...p, created_by: user?.id, owner_id: p.owner_id ?? user?.id };
        const { data: created, error } = await supabase
          .from("action_plan")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        const planId = created.id;
        await autoPopulatePlan(planId, user!.id);
      }
    },
    onSuccess: () => {
      toast.success("Plano salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["action_plans"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_plan").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano excluído");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["action_plans"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos de Ação"
        description="Gerencie planos de ação originados de reuniões, projetos, auditorias e outras fontes"
        actions={
          <Button onClick={() => setEditing({ ...emptyPlan })}>
            <Plus className="h-4 w-4 mr-2" /> Novo plano
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, título ou descrição"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <TeamFiltersBar
              value={filters}
              onChange={setFilters}
              statusOptions={STATUS.map((s) => ({ value: s, label: s }))}
              priorityOptions={PRIORITY.map((p) => ({ value: p, label: p }))}
            />
          </div>

          {list.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum plano encontrado.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead>Prev. término</TableHead>
                    <TableHead className="w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ORIGIN.find((o) => o.v === p.origin_type)?.l || p.origin_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[p.status]}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={priorityColor[p.priority]}>{p.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.progress}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.planned_end_date ? new Date(p.planned_end_date).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button asChild variant="ghost" size="icon" title="Abrir">
                            <Link to={`/planos-acao/${p.id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir" onClick={() => setToDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Sheet */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Editar plano de ação" : "Novo plano de ação"}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div>
                <Label>Título *</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Objetivo</Label>
                <Textarea
                  rows={2}
                  value={editing.objective || ""}
                  onChange={(e) => setEditing({ ...editing, objective: e.target.value })}
                />
              </div>
              <div>
                <Label>Justificativa</Label>
                <Textarea
                  rows={2}
                  value={editing.justification || ""}
                  onChange={(e) => setEditing({ ...editing, justification: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={editing.origin_type || "manual"}
                    onValueChange={(v) => setEditing({ ...editing, origin_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORIGIN.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editing.status || "Rascunho"}
                    onValueChange={(v) => setEditing({ ...editing, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={editing.priority || "Média"}
                    onValueChange={(v) => setEditing({ ...editing, priority: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Progresso (%)</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={editing.progress ?? 0}
                    onChange={(e) => setEditing({ ...editing, progress: Math.max(0, Math.min(100, parseInt(e.target.value || "0"))) })}
                  />
                </div>
                <div>
                  <Label>Início previsto</Label>
                  <Input
                    type="date"
                    value={editing.planned_start_date || ""}
                    onChange={(e) => setEditing({ ...editing, planned_start_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Término previsto</Label>
                  <Input
                    type="date"
                    value={editing.planned_end_date || ""}
                    onChange={(e) => setEditing({ ...editing, planned_end_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Início real</Label>
                  <Input
                    type="date"
                    value={editing.actual_start_date || ""}
                    onChange={(e) => setEditing({ ...editing, actual_start_date: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Término real</Label>
                  <Input
                    type="date"
                    value={editing.actual_end_date || ""}
                    onChange={(e) => setEditing({ ...editing, actual_end_date: e.target.value || null })}
                  />
                </div>
              </div>
            </div>
          )}
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && save.mutate(editing)}
              disabled={!editing?.title || save.isPending}
            >
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano <strong>{toDelete?.code} — {toDelete?.title}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
