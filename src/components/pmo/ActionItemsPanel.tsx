import { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type ActionItem = {
  id: string;
  action_plan_id: string;
  code: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_external_name: string | null;
  what: string | null;
  why: string | null;
  where_loc: string | null;
  how: string | null;
  how_much: number | null;
  priority: string;
  status: string;
  progress: number;
  planned_start_date: string | null;
  due_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  sort_order: number;
};

const STATUS = ["Pendente","Em andamento","Concluída","Cancelada","Bloqueada","Atrasada"];
const PRIORITY = ["Baixa","Média","Alta","Crítica"];

const statusColor: Record<string, string> = {
  "Pendente": "bg-muted text-muted-foreground",
  "Em andamento": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Concluída": "bg-green-500/15 text-green-700 dark:text-green-300",
  "Cancelada": "bg-red-500/15 text-red-700 dark:text-red-300",
  "Bloqueada": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Atrasada": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
};

const priorityColor: Record<string, string> = {
  "Baixa": "bg-muted text-muted-foreground",
  "Média": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Alta": "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "Crítica": "bg-red-500/15 text-red-700 dark:text-red-300",
};

const emptyItem: Partial<ActionItem> = {
  title: "",
  description: "",
  priority: "Média",
  status: "Pendente",
  progress: 0,
};

export default function ActionItemsPanel({ planId }: { planId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ActionItem> | null>(null);
  const [toDelete, setToDelete] = useState<ActionItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { data: items, isLoading } = useQuery({
    queryKey: ["action_items", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_item")
        .select("*")
        .eq("action_plan_id", planId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data || []) as ActionItem[];
    },
  });

  const { data: profiles } = useSelectableUsers();

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    (profiles || []).forEach((p: any) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const save = useMutation({
    mutationFn: async (it: Partial<ActionItem>) => {
      if (it.id) {
        const { id, ...rest } = it;
        const { error } = await supabase.from("action_item").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const payload = { ...it, action_plan_id: planId, created_by: user?.id };
        const { error } = await supabase.from("action_item").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Ação salva");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["action_items", planId] });
      qc.invalidateQueries({ queryKey: ["action_plan", planId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const quickUpdate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ActionItem> }) => {
      const { error } = await supabase.from("action_item").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action_items", planId] });
      qc.invalidateQueries({ queryKey: ["action_plan", planId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_item").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação excluída");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: ["action_items", planId] });
      qc.invalidateQueries({ queryKey: ["action_plan", planId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Ações ({items?.length || 0})</h3>
        <Button size="sm" onClick={() => setEditing({ ...emptyItem })}>
          <Plus className="h-4 w-4 mr-1" /> Nova ação
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !items?.length ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">
          Nenhuma ação cadastrada. Clique em "Nova ação" para começar.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[36px]"></TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="w-[110px]">% Progresso</TableHead>
                <TableHead className="w-[100px] text-center">Concluída</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const isOpen = expanded.has(it.id);
                const assigneeName = it.assignee_id
                  ? (profileMap.get(it.assignee_id)?.name || "—")
                  : (it.assignee_external_name || "—");
                return (
                <Fragment key={it.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => toggleExpand(it.id)}
                >
                  <TableCell onClick={(e) => { e.stopPropagation(); toggleExpand(it.id); }}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{it.code}</TableCell>
                  <TableCell className="font-medium">{it.title}</TableCell>
                  <TableCell className="text-sm">{assigneeName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {it.due_date ? new Date(it.due_date).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColor[it.status]}>{it.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={priorityColor[it.priority]}>{it.priority}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={it.progress}
                      key={`${it.id}-${it.progress}`}
                      className="h-8 w-20"
                      disabled={it.status === "Concluída" || it.status === "Cancelada"}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(100, parseInt(e.target.value || "0")));
                        if (v !== it.progress) quickUpdate.mutate({ id: it.id, patch: { progress: v } });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={it.status === "Concluída"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          quickUpdate.mutate({
                            id: it.id,
                            patch: { status: "Concluída", progress: 100, actual_end_date: new Date().toISOString().slice(0, 10) },
                          });
                        } else {
                          quickUpdate.mutate({
                            id: it.id,
                            patch: { status: "Em andamento", actual_end_date: null },
                          });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(it)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(it)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow key={`${it.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                    <TableCell></TableCell>
                    <TableCell colSpan={9} className="py-4">
                      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div className="md:col-span-2">
                          <div className="text-xs uppercase text-muted-foreground mb-1">Descrição</div>
                          <div className="whitespace-pre-wrap">{it.description || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-muted-foreground mb-1">Início previsto</div>
                          <div>{it.planned_start_date ? new Date(it.planned_start_date).toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-muted-foreground mb-1">Início real</div>
                          <div>{it.actual_start_date ? new Date(it.actual_start_date).toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-muted-foreground mb-1">Prazo</div>
                          <div>{it.due_date ? new Date(it.due_date).toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-muted-foreground mb-1">Término real</div>
                          <div>{it.actual_end_date ? new Date(it.actual_end_date).toLocaleDateString("pt-BR") : "—"}</div>
                        </div>
                        {(it.what || it.why || it.where_loc || it.how || it.how_much != null) && (
                          <div className="md:col-span-2 border-t pt-3 mt-1">
                            <div className="text-xs uppercase text-muted-foreground mb-2 font-semibold">5W2H</div>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
                              {it.what && <div><span className="text-muted-foreground">O quê: </span>{it.what}</div>}
                              {it.why && <div><span className="text-muted-foreground">Por quê: </span>{it.why}</div>}
                              {it.where_loc && <div><span className="text-muted-foreground">Onde: </span>{it.where_loc}</div>}
                              {it.how && <div><span className="text-muted-foreground">Como: </span>{it.how}</div>}
                              {it.how_much != null && (
                                <div><span className="text-muted-foreground">Quanto: </span>R$ {Number(it.how_much).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="md:col-span-2 flex justify-end">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(it); }}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar detalhes
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? "Editar ação" : "Nova ação"}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div>
                <Label>Título *</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={3} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Responsável (do sistema)</Label>
                  <Select
                    value={editing.assignee_id || "none"}
                    onValueChange={(v) => setEditing({ ...editing, assignee_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {(profiles || []).map((p: any) => (
                        <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável externo (opcional)</Label>
                  <Input
                    value={editing.assignee_external_name || ""}
                    onChange={(e) => setEditing({ ...editing, assignee_external_name: e.target.value || null })}
                    placeholder="Nome livre"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editing.status || "Pendente"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={editing.priority || "Média"} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
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
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={editing.due_date || ""}
                    onChange={(e) => setEditing({ ...editing, due_date: e.target.value || null })}
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
                  <Label>Término real</Label>
                  <Input
                    type="date"
                    value={editing.actual_end_date || ""}
                    onChange={(e) => setEditing({ ...editing, actual_end_date: e.target.value || null })}
                  />
                </div>
              </div>

              <details className="border rounded-md p-3">
                <summary className="text-sm font-medium cursor-pointer">5W2H (opcional)</summary>
                <div className="grid grid-cols-1 gap-3 mt-3">
                  <div><Label>O quê</Label><Textarea rows={2} value={editing.what || ""} onChange={(e) => setEditing({ ...editing, what: e.target.value })} /></div>
                  <div><Label>Por quê</Label><Textarea rows={2} value={editing.why || ""} onChange={(e) => setEditing({ ...editing, why: e.target.value })} /></div>
                  <div><Label>Onde</Label><Input value={editing.where_loc || ""} onChange={(e) => setEditing({ ...editing, where_loc: e.target.value })} /></div>
                  <div><Label>Como</Label><Textarea rows={2} value={editing.how || ""} onChange={(e) => setEditing({ ...editing, how: e.target.value })} /></div>
                  <div>
                    <Label>Quanto (R$)</Label>
                    <Input
                      type="number" step="0.01"
                      value={editing.how_much ?? ""}
                      onChange={(e) => setEditing({ ...editing, how_much: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>
              </details>
            </div>
          )}
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={!editing?.title || save.isPending}>
              Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ação</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{toDelete?.code} — {toDelete?.title}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
