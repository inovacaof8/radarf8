import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export default function ActionItemEditDialog({
  open,
  onOpenChange,
  item,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: any | null;
  profiles: any[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      title: item.title ?? "",
      description: item.description ?? "",
      assignee_id: item.assignee_id ?? "none",
      assignee_external_name: item.assignee_external_name ?? "",
      assignee_email_hint: item.assignee_email_hint ?? "",
      due_date: item.due_date ?? "",
      priority: item.priority ?? "media",
      status: item.status ?? "pendente",
    });
  }, [item?.id]);

  if (!item) return null;

  const save = async () => {
    setSaving(true);
    const patch = {
      title: form.title,
      description: form.description || null,
      assignee_id: form.assignee_id && form.assignee_id !== "none" ? form.assignee_id : null,
      assignee_external_name:
        form.assignee_id && form.assignee_id !== "none" ? null : (form.assignee_external_name || null),
      assignee_email_hint: form.assignee_email_hint || null,
      due_date: form.due_date || null,
      priority: form.priority,
      status: form.status,
    };
    const { error } = await supabase.from("meeting_action_item").update(patch).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Atividade atualizada");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar atividade</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={form.assignee_id} onValueChange={(v) => setForm({ ...form, assignee_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— externo / não vinculado —</SelectItem>
                {profiles.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável externo</Label>
            <Input
              value={form.assignee_external_name}
              onChange={(e) => setForm({ ...form, assignee_external_name: e.target.value })}
              disabled={form.assignee_id && form.assignee_id !== "none"}
            />
          </div>
          <div>
            <Label>Prazo</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Pista de e-mail (vindo da IA)</Label>
            <Input
              value={form.assignee_email_hint}
              onChange={(e) => setForm({ ...form, assignee_email_hint: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
