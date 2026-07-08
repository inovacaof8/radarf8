import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, GitBranch, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkflows, useWorkflowSteps, type Workflow, type WorkflowStep } from "@/hooks/useWorkflows";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";

export default function Workflows() {
  const { data: workflows = [] } = useWorkflows();
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch className="h-6 w-6" /> Workflows</h1>
          <p className="text-sm text-muted-foreground">Fluxos de demandas com etapas e aprovação parametrizável.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />Novo workflow</Button>
      </div>

      <div className="grid gap-3">
        {workflows.map((w) => (
          <Card key={w.id} className="cursor-pointer hover:shadow" onClick={() => setEditing(w)}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{w.name}</CardTitle>
                <Badge variant={w.status === "active" ? "default" : "secondary"}>{w.status}</Badge>
              </div>
            </CardHeader>
            {w.description && <CardContent className="pt-0 text-sm text-muted-foreground">{w.description}</CardContent>}
          </Card>
        ))}
        {workflows.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum workflow criado. Clique em "Novo workflow" para começar.</p>
        )}
      </div>

      {creating && <WorkflowFormDialog onClose={() => setCreating(false)} />}
      {editing && <WorkflowEditor workflow={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function WorkflowFormDialog({ workflow, onClose }: { workflow?: Workflow; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [status, setStatus] = useState(workflow?.status ?? "active");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      if (workflow) {
        const { error } = await supabase.from("workflow").update({ name, description, status }).eq("id", workflow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workflow").insert({ name, description, status });
        if (error) throw error;
      }
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["workflows"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{workflow ? "Editar" : "Novo"} workflow</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>Situação</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowEditor({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const { data: steps = [] } = useWorkflowSteps(workflow.id);
  const [stepEditor, setStepEditor] = useState<Partial<WorkflowStep> | null>(null);
  const [editingWf, setEditingWf] = useState(false);
  const qc = useQueryClient();

  async function removeStep(id: string) {
    if (!confirm("Remover etapa?")) return;
    const { error } = await supabase.from("workflow_steps").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["workflow_steps", workflow.id] });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft className="h-4 w-4" /></Button>
              {workflow.name}
            </DialogTitle>
            <Button size="sm" variant="outline" onClick={() => setEditingWf(true)}>Editar workflow</Button>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Etapas</h3>
            <Button size="sm" onClick={() => setStepEditor({ workflow_id: workflow.id, order_index: (steps.at(-1)?.order_index ?? 0) + 10, sla_hours: 24, default_responsible_type: "user", requires_approval: false })}>
              <Plus className="h-4 w-4 mr-1" />Nova etapa
            </Button>
          </div>
          {steps.map((s) => (
            <Card key={s.id} className="cursor-pointer" onClick={() => setStepEditor(s)}>
              <CardContent className="p-3 flex items-center gap-3">
                <Badge variant="outline">{s.order_index}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">SLA {s.sla_hours}h · Responsável: {s.default_responsible_type}
                    {s.requires_approval && <> · <span className="text-amber-600">Requer aprovação ({s.approver_type})</span></>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeStep(s.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {steps.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>}
        </div>

        {stepEditor && <StepEditorDialog step={stepEditor} onClose={() => setStepEditor(null)} workflowId={workflow.id} />}
        {editingWf && <WorkflowFormDialog workflow={workflow} onClose={() => setEditingWf(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function StepEditorDialog({ step, workflowId, onClose }: { step: Partial<WorkflowStep>; workflowId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useSelectableUsers();
  const [form, setForm] = useState<any>({ ...step });
  const [saving, setSaving] = useState(false);

  function set<K extends string>(k: K, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name?.trim()) return toast.error("Informe o nome da etapa");
    if (form.requires_approval && !form.approver_type) return toast.error("Selecione o tipo de aprovador");
    if (form.requires_approval && form.approver_type !== "area_manager" && !form.approver_user_id) return toast.error("Selecione o aprovador");
    if (form.default_responsible_type === "user" && !form.default_responsible_user_id) return toast.error("Selecione o responsável padrão");

    setSaving(true);
    try {
      const payload = {
        workflow_id: workflowId,
        order_index: Number(form.order_index) || 10,
        name: form.name,
        description: form.description || null,
        sla_hours: Number(form.sla_hours) || 24,
        default_responsible_type: form.default_responsible_type,
        default_responsible_user_id: form.default_responsible_type === "user" ? form.default_responsible_user_id : null,
        default_responsible_area_id: form.default_responsible_type === "area_manager" ? form.default_responsible_area_id : null,
        requires_approval: !!form.requires_approval,
        approver_type: form.requires_approval ? form.approver_type : null,
        approver_user_id: form.requires_approval && form.approver_type !== "area_manager" ? form.approver_user_id : null,
        approver_area_id: null,
      };
      let error;
      if (form.id) ({ error } = await supabase.from("workflow_steps").update(payload).eq("id", form.id));
      else ({ error } = await supabase.from("workflow_steps").insert(payload));
      if (error) throw error;
      toast.success("Etapa salva");
      qc.invalidateQueries({ queryKey: ["workflow_steps", workflowId] });
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{form.id ? "Editar" : "Nova"} etapa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1"><Label>Ordem</Label><Input type="number" value={form.order_index ?? ""} onChange={(e) => set("order_index", e.target.value)} /></div>
            <div className="col-span-3"><Label>Nome</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          </div>
          <div><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>SLA (horas)</Label><Input type="number" value={form.sla_hours ?? 24} onChange={(e) => set("sla_hours", e.target.value)} /></div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.default_responsible_type} onValueChange={(v) => set("default_responsible_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário específico</SelectItem>
                  <SelectItem value="creator">Criador da demanda</SelectItem>
                  <SelectItem value="previous_step">Responsável anterior</SelectItem>
                  <SelectItem value="area_manager">Gestor de área</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.default_responsible_type === "user" && (
            <div>
              <Label>Usuário responsável</Label>
              <Select value={form.default_responsible_user_id ?? ""} onValueChange={(v) => set("default_responsible_user_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Exige aprovação?</Label>
                <p className="text-xs text-muted-foreground">A demanda só avança após o aprovador aprovar.</p>
              </div>
              <Switch checked={!!form.requires_approval} onCheckedChange={(v) => set("requires_approval", v)} />
            </div>
            {form.requires_approval && (
              <>
                <div>
                  <Label>Tipo de aprovador</Label>
                  <Select value={form.approver_type ?? ""} onValueChange={(v) => set("approver_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário específico</SelectItem>
                      <SelectItem value="area_manager">Gestor da pessoa responsável</SelectItem>
                      <SelectItem value="configured">Responsável parametrizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.approver_type && form.approver_type !== "area_manager" && (
                  <div>
                    <Label>Usuário aprovador</Label>
                    <Select value={form.approver_user_id ?? ""} onValueChange={(v) => set("approver_user_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {form.approver_type === "area_manager" && (
                  <p className="text-xs text-muted-foreground">
                    O aprovador será resolvido automaticamente como o gestor da área do responsável atual da demanda.
                  </p>
                )}
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠ Esta etapa só avançará após a aprovação. O próximo responsável só será notificado depois da decisão.
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
