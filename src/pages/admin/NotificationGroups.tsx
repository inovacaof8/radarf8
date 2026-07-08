import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NOTIF_GROUP_TYPES } from "@/lib/notificationLabels";
import { Plus, Users, Trash2 } from "lucide-react";

export default function NotificationGroups() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name: "", description: "", area_id: "", group_type: "permanente", member_ids: [] as string[] });

  const { data: groups = [] } = useQuery({
    queryKey: ["notif-groups-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_group")
        .select("*, area:area_id(name)")
        .order("name");
      if (error) throw error;
      const leaderIds = Array.from(new Set((data || []).map((g: any) => g.leader_user_id).filter(Boolean)));
      const { data: leaders } = leaderIds.length
        ? await supabase.from("profiles").select("user_id, name").in("user_id", leaderIds)
        : { data: [] as any[] };
      const map = new Map((leaders || []).map((l: any) => [l.user_id, l.name]));
      return (data || []).map((g: any) => ({ ...g, leader: g.leader_user_id ? { name: map.get(g.leader_user_id) } : null }));
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-active-groups"],
    queryFn: async () => (await supabase.from("area").select("id, name").eq("status", "active").order("name")).data || [],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-active-groups"],
    queryFn: async () => (await supabase.from("profiles").select("user_id, name, email").eq("status", "active").order("name")).data || [],
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", editingId],
    enabled: !!editingId,
    queryFn: async () => (await supabase.from("notification_group_member").select("user_id").eq("group_id", editingId!).eq("status", "active")).data || [],
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", description: "", area_id: "", group_type: "permanente", member_ids: [] });
    setOpen(true);
  };

  const openEdit = async (g: any) => {
    setEditingId(g.id);
    const { data: m } = await supabase.from("notification_group_member").select("user_id").eq("group_id", g.id).eq("status", "active");
    setForm({
      name: g.name, description: g.description || "", area_id: g.area_id || "",
      group_type: g.group_type, member_ids: (m || []).map((x: any) => x.user_id),
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome obrigatório");
      let gid = editingId;
      if (editingId) {
        const { error } = await supabase.from("notification_group").update({
          name: form.name, description: form.description, area_id: form.area_id || null,
          group_type: form.group_type, updated_by: profile!.user_id,
        }).eq("id", editingId);
        if (error) throw error;
        await supabase.from("notification_group_member").delete().eq("group_id", editingId);
      } else {
        const { data, error } = await supabase.from("notification_group").insert({
          name: form.name, description: form.description, area_id: form.area_id || null,
          group_type: form.group_type, leader_user_id: profile!.user_id, created_by: profile!.user_id,
        }).select().single();
        if (error) throw error;
        gid = data.id;
      }
      if (form.member_ids.length > 0) {
        await supabase.from("notification_group_member").insert(
          form.member_ids.map((uid: string) => ({ group_id: gid, user_id: uid, added_by: profile!.user_id }))
        );
      }
    },
    onSuccess: () => { toast.success("Grupo salvo"); qc.invalidateQueries({ queryKey: ["notif-groups-admin"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_group").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Grupo excluído"); qc.invalidateQueries({ queryKey: ["notif-groups-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grupos de Notificação</h1>
          <p className="text-sm text-muted-foreground">Conjuntos de pessoas para envio de notificações</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo grupo</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Líder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell><Badge variant="outline">{NOTIF_GROUP_TYPES[g.group_type]}</Badge></TableCell>
                  <TableCell>{g.area?.name || "—"}</TableCell>
                  <TableCell>{g.leader?.name || "—"}</TableCell>
                  <TableCell>{g.status}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}><Users className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir grupo?")) delMut.mutate(g.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {groups.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum grupo cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-auto">
          <SheetHeader><SheetTitle>{editingId ? "Editar grupo" : "Novo grupo"}</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.group_type} onValueChange={(v) => setForm({ ...form, group_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTIF_GROUP_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Área (opcional)</Label>
              <Select value={form.area_id || "none"} onValueChange={(v) => setForm({ ...form, area_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem área</SelectItem>
                  {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Participantes</Label>
              <div className="border rounded-md p-2 max-h-60 overflow-auto space-y-1">
                {users.map((u: any) => (
                  <label key={u.user_id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.member_ids.includes(u.user_id)}
                      onCheckedChange={(c) => setForm({
                        ...form,
                        member_ids: c ? [...form.member_ids, u.user_id] : form.member_ids.filter((x: string) => x !== u.user_id),
                      })}
                    />
                    {u.name} <span className="text-muted-foreground text-xs">({u.email})</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{form.member_ids.length} participante(s)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
