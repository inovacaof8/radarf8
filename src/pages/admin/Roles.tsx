import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, ShieldOff, ShieldCheck, Loader2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function RolesPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("*").order("created_at");
      return data || [];
    },
  });

  const openNew = () => { setEditingId(null); setFormData({ name: "", description: "" }); setDialogOpen(true); };
  const openEdit = (role: any) => { setEditingId(role.id); setFormData({ name: role.name, description: role.description || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    if (editingId) {
      await supabase.from("roles").update({ name: formData.name, description: formData.description }).eq("id", editingId);
      await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "role_edited", module: "roles", entity: "role", entity_id: editingId, details: `Perfil ${formData.name} editado` });
      toast.success("Perfil atualizado.");
    } else {
      const { data } = await supabase.from("roles").insert({ name: formData.name, description: formData.description }).select().single();
      if (data) await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "role_created", module: "roles", entity: "role", entity_id: data.id, details: `Perfil ${formData.name} criado` });
      toast.success("Perfil criado.");
    }
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["roles-all"] });
  };

  const toggleActive = async (role: any) => {
    await supabase.from("roles").update({ is_active: !role.is_active }).eq("id", role.id);
    await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: role.is_active ? "role_deactivated" : "role_activated", module: "roles", entity: "role", entity_id: role.id, details: `Perfil ${role.name} ${role.is_active ? "inativado" : "ativado"}` });
    toast.success(`Perfil ${role.is_active ? "inativado" : "ativado"}.`);
    queryClient.invalidateQueries({ queryKey: ["roles-all"] });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Gestão de Perfis</h1><p className="text-muted-foreground">Gerencie os perfis de acesso do sistema</p></div>
        {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Perfil</Button>}
      </div>
      <Card><CardContent className="pt-6">
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {!roles?.length ? (
                <TableRow><TableCell colSpan={5} className="py-0">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-3 rounded-full bg-muted mb-4"><Shield className="h-8 w-8 text-muted-foreground" /></div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum perfil cadastrado</h3>
                    <p className="text-sm text-muted-foreground">Crie um novo perfil de acesso.</p>
                  </div>
                </TableCell></TableRow>
              ) : roles?.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded ${role.is_system ? "status-active" : "status-inactive"}`}>{role.is_system ? "Sistema" : "Customizado"}</span></TableCell>
                  <TableCell><span className={`text-xs px-2 py-0.5 rounded ${role.is_active ? "status-active" : "status-inactive"}`}>{role.is_active ? "Ativo" : "Inativo"}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/permissions?role=${role.id}`)} title="Editar permissões"><Lock className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(role)}><Edit className="h-4 w-4" /></Button>
                      {!role.is_system && <Button variant="ghost" size="sm" onClick={() => toggleActive(role)}>{role.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
          </Table>
        </div>
      </CardContent></Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Perfil" : "Novo Perfil"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
