import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, ShieldOff, ShieldCheck, KeyRound, AlertCircle, UserPlus, Loader2, Copy, Upload, ChevronLeft, ChevronRight, Users, Download, UserMinus, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import UserImportDialog from "@/components/admin/UserImportDialog";
import { AreaCombobox } from "@/components/admin/AreaCombobox";

export default function UsersPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; email: string; roleIds: string[]; notes: string; position: string; primaryAreaId: string; directManagerId: string; startDate: string }>({ name: "", email: "", roleIds: [], notes: "", position: "", primaryAreaId: "none", directManagerId: "none", startDate: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{ open: boolean; password: string; email: string }>({ open: false, password: "", email: "" });
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, user_roles(role_id, roles(id, name))");
      return data || [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const { data: areas } = useQuery({
    queryKey: ["areas-active"],
    queryFn: async () => {
      const { data } = await supabase.from("area").select("id, name, acronym").eq("status", "active").order("name");
      return data || [];
    },
  });

  // Gestores ativos por área (para sugerir gestor direto automaticamente)
  const { data: areaManagers } = useQuery({
    queryKey: ["area-managers-active"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("area_manager")
        .select("area_id, user_id, manager_type, start_date, end_date, status")
        .eq("status", "active")
        .lte("start_date", today);
      return (data || []).filter((m: any) => !m.end_date || m.end_date >= today);
    },
  });

  const getAreaPrimaryManager = (areaId: string | null | undefined): string | null => {
    if (!areaId || !areaManagers) return null;
    const list = areaManagers.filter((m: any) => m.area_id === areaId);
    if (list.length === 0) return null;
    return (list.find((m: any) => m.manager_type === "primary") || list[0]).user_id as string;
  };

  // Quando a área principal muda, sugere o gestor direto automaticamente
  const handleAreaChange = (areaId: string) => {
    const prevAreaMgr = getAreaPrimaryManager(formData.primaryAreaId === "none" ? null : formData.primaryAreaId);
    const newAreaMgr = getAreaPrimaryManager(areaId === "none" ? null : areaId);
    const shouldOverwrite =
      formData.directManagerId === "none" ||
      (prevAreaMgr && formData.directManagerId === prevAreaMgr);
    setFormData({
      ...formData,
      primaryAreaId: areaId,
      directManagerId: shouldOverwrite && newAreaMgr && newAreaMgr !== editingId
        ? newAreaMgr
        : formData.directManagerId,
    });
  };


  const { filtered: users, total, totalPages } = useMemo(() => {
    if (!profiles) return { filtered: [], total: 0, totalPages: 0 };
    let result = profiles as any[];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((u: any) => u.name?.toLowerCase().includes(s));
    }
    if (statusFilter !== "all") result = result.filter((u: any) => u.status === statusFilter);
    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const paged = result.slice((page - 1) * pageSize, page * pageSize);
    return { filtered: paged, total, totalPages };
  }, [profiles, search, statusFilter, page]);

  const getUserRoles = (u: any): { id: string; name: string }[] =>
    (u.user_roles || [])
      .map((ur: any) => ur.roles)
      .filter((r: any): r is { id: string; name: string } => !!r);
  const getRoleNames = (u: any) => {
    const list = getUserRoles(u).map((r) => r.name);
    return list.length > 0 ? list.join(", ") : "Sem perfil";
  };
  const getRoleIds = (u: any) => getUserRoles(u).map((r) => r.id);

  const openNew = () => {
    setEditingId(null);
    setFormData({ name: "", email: "", roleIds: [], notes: "", position: "", primaryAreaId: "none", directManagerId: "none", startDate: "" });
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (u: any) => {
    setEditingId(u.user_id);
    setFormData({
      name: u.name,
      email: "",
      roleIds: getRoleIds(u),
      notes: u.notes || "",
      position: u.position || "",
      primaryAreaId: u.primary_area_id || "none",
      directManagerId: u.direct_manager_id || "none",
      startDate: u.start_date || "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const syncPrimaryArea = async (uid: string, newAreaId: string | null) => {
    // Encerra vínculos principais ativos que não sejam o desejado
    await supabase.from("user_area_membership")
      .update({ status: "inactive", end_date: new Date().toISOString().slice(0, 10) })
      .eq("user_id", uid).eq("membership_type", "primary").eq("status", "active");
    if (newAreaId) {
      // Verifica se já existe um vínculo principal (mesmo inativo) para reativar; senão cria
      const { data: existing } = await supabase.from("user_area_membership")
        .select("id").eq("user_id", uid).eq("area_id", newAreaId).eq("membership_type", "primary").maybeSingle();
      if (existing) {
        await supabase.from("user_area_membership").update({ status: "active", end_date: null }).eq("id", existing.id);
      } else {
        await supabase.from("user_area_membership").insert({
          user_id: uid, area_id: newAreaId, membership_type: "primary",
          start_date: new Date().toISOString().slice(0, 10), status: "active", created_by: user!.id,
        });
      }
    }
  };

  const handleSave = async () => {
    setFormError("");
    if (!formData.name.trim()) { setFormError("Nome é obrigatório."); return; }
    if (formData.roleIds.length === 0) { setFormError("Selecione pelo menos um perfil de acesso."); return; }
    setSaving(true);

    const profilePatch: any = {
      name: formData.name,
      notes: formData.notes,
      position: formData.position || null,
      primary_area_id: formData.primaryAreaId === "none" ? null : formData.primaryAreaId,
      direct_manager_id: formData.directManagerId === "none" ? null : formData.directManagerId,
      start_date: formData.startDate || null,
    };

    if (editingId) {
      const prev = profiles?.find((p: any) => p.user_id === editingId);
      if (formData.directManagerId !== "none" && formData.directManagerId === editingId) {
        setFormError("O gestor direto não pode ser o próprio usuário.");
        setSaving(false); return;
      }
      const { error: updateError } = await supabase.from("profiles").update(profilePatch).eq("user_id", editingId);
      if (updateError) {
        setFormError("Erro ao atualizar usuário: " + updateError.message);
        setSaving(false);
        return;
      }
      // Sincroniza perfis por diferença (evita ficar sem perfil entre delete/insert).
      const prevRoleIds: string[] = Array.isArray((prev as any)?.user_roles)
        ? (prev as any).user_roles.map((ur: any) => ur.role_id).filter(Boolean)
        : [];
      const toAdd = formData.roleIds.filter((rid) => !prevRoleIds.includes(rid));
      const toRemove = prevRoleIds.filter((rid) => !formData.roleIds.includes(rid));
      if (toAdd.length > 0) {
        const { error: insErr } = await supabase.from("user_roles").insert(
          toAdd.map((rid) => ({ user_id: editingId!, role_id: rid }))
        );
        if (insErr) { setFormError("Erro ao atribuir perfis: " + insErr.message); setSaving(false); return; }
      }
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase.from("user_roles")
          .delete().eq("user_id", editingId!).in("role_id", toRemove);
        if (delErr) { setFormError("Erro ao remover perfis: " + delErr.message); setSaving(false); return; }
      }
      if ((prev?.primary_area_id || null) !== (profilePatch.primary_area_id || null)) {
        await syncPrimaryArea(editingId, profilePatch.primary_area_id);
      }
      await supabase.from("audit_logs").insert({
        user_id: user!.id, user_name: profile?.name || "", action: "user_edited", module: "users",
        entity: "user", entity_id: editingId, details: `Usuário ${formData.name} editado`,
        previous_value: JSON.stringify({ name: prev?.name, primary_area_id: prev?.primary_area_id }),
        new_value: JSON.stringify({ name: formData.name, primary_area_id: profilePatch.primary_area_id }),
      });
      toast.success("Usuário atualizado.");
      setDialogOpen(false);
    } else {
      if (!formData.email.trim()) { setFormError("E-mail é obrigatório."); setSaving(false); return; }

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: formData.email, name: formData.name, roleIds: formData.roleIds, notes: formData.notes },
      });

      if (error || data?.error) {
        setFormError(data?.error || "Erro ao criar usuário.");
        setSaving(false);
        return;
      }

      // Completa o perfil recém-criado com campos da área
      const newUserId = data.userId;
      if (profilePatch.position || profilePatch.primary_area_id || profilePatch.direct_manager_id || profilePatch.start_date) {
        await supabase.from("profiles").update({
          position: profilePatch.position,
          primary_area_id: profilePatch.primary_area_id,
          direct_manager_id: profilePatch.direct_manager_id,
          start_date: profilePatch.start_date,
        }).eq("user_id", newUserId);
      }
      if (profilePatch.primary_area_id) {
        await syncPrimaryArea(newUserId, profilePatch.primary_area_id);
      }

      await supabase.from("audit_logs").insert({
        user_id: user!.id, user_name: profile?.name || "", action: "user_created", module: "users",
        entity: "user", entity_id: newUserId, details: `Usuário ${formData.name} (${formData.email}) criado`,
      });

      setDialogOpen(false);
      setTempPasswordDialog({ open: true, password: data.tempPassword, email: formData.email });
      toast.success("Usuário criado com sucesso.");
    }
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };


  const toggleStatus = (u: any, newStatus: string) => {
    const labels: Record<string, string> = { active: "ativar", inactive: "inativar", blocked: "desbloquear" };
    setConfirmAction({
      open: true,
      title: `${labels[newStatus]?.charAt(0).toUpperCase()}${labels[newStatus]?.slice(1)} usuário`,
      description: `Tem certeza que deseja ${labels[newStatus]} o usuário "${u.name}"?`,
      onConfirm: async () => {
        if (newStatus === "inactive" && getUserRoles(u).some((r) => r.name === "Administrador")) {
          const activeAdmins = profiles?.filter((p: any) => getUserRoles(p).some((r) => r.name === "Administrador") && p.status === "active");
          if (activeAdmins && activeAdmins.length <= 1) {
            toast.error("Não é possível inativar o último administrador ativo.");
            return;
          }
        }
        await supabase.from("profiles").update({ status: newStatus as any, login_attempts: 0, locked_until: null }).eq("user_id", u.user_id);
        await supabase.from("audit_logs").insert({
          user_id: user!.id, user_name: profile?.name || "", action: `user_${newStatus}`, module: "users",
          entity: "user", entity_id: u.user_id, details: `Usuário ${u.name} alterado para ${newStatus}`,
          previous_value: u.status, new_value: newStatus,
        });
        toast.success(`Usuário ${newStatus === "active" ? "ativado" : newStatus === "inactive" ? "inativado" : "desbloqueado"}.`);
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      },
    });
  };

  const resetPassword = (u: any) => {
    setConfirmAction({
      open: true,
      title: "Redefinir Senha",
      description: `Tem certeza que deseja redefinir a senha do usuário "${u.name}"? Uma nova senha temporária será gerada.`,
      onConfirm: async () => {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "reset_password", userId: u.user_id },
        });
        if (error || data?.error) {
          toast.error(data?.error || "Erro ao redefinir senha.");
          return;
        }
        await supabase.from("audit_logs").insert({
          user_id: user!.id, user_name: profile?.name || "", action: "password_reset", module: "users",
          entity: "user", entity_id: u.user_id, details: `Senha de ${u.name} redefinida pelo admin`,
        });
        setTempPasswordDialog({ open: true, password: data.tempPassword, email: u.name });
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      },
    });
  };

  const forcePasswordChange = async (u: any) => {
    await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", u.user_id);
    await supabase.from("audit_logs").insert({
      user_id: user!.id, user_name: profile?.name || "", action: "force_password_change", module: "users",
      entity: "user", entity_id: u.user_id, details: `Troca obrigatória de senha para ${u.name}`,
    });
    toast.success("Troca de senha obrigatória definida.");
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const exportUserData = async (u: any) => {
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "export_user_data", userId: u.user_id },
    });
    if (error || data?.error) {
      toast.error("Erro ao exportar dados.");
      return;
    }
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dados_usuario_${u.name.replace(/\s/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Dados exportados com sucesso (LGPD).");
  };

  const anonymizeUser = (u: any) => {
    setConfirmAction({
      open: true,
      title: "Anonimizar Usuário (LGPD)",
      description: `ATENÇÃO: Esta ação é irreversível! Todos os dados pessoais de "${u.name}" serão anonimizados conforme LGPD Art. 18. Deseja continuar?`,
      onConfirm: async () => {
        const { error } = await supabase.functions.invoke("manage-users", {
          body: { action: "anonymize", userId: u.user_id },
        });
        if (error) {
          toast.error("Erro ao anonimizar dados.");
          return;
        }
        toast.success("Dados anonimizados com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      },
    });
  };

  const statusBadge = (status: string) => {
    const config: Record<string, string> = { active: "status-active", inactive: "status-inactive", blocked: "status-blocked" };
    const labels: Record<string, string> = { active: "Ativo", inactive: "Inativo", blocked: "Bloqueado" };
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${config[status] || ""}`}>{labels[status] || status}</span>;
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="h-4 w-4" /> Importar</Button>
            <Button onClick={openNew} className="gap-2"><UserPlus className="h-4 w-4" /> Novo Usuário</Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
               <TableRow>
                   <TableHead>Nome</TableHead>
                   <TableHead>E-mail</TableHead>
                   <TableHead>Perfil</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Último Acesso</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                   <TableRow><TableCell colSpan={6} className="py-0">
                     <div className="flex flex-col items-center justify-center py-12 text-center">
                       <div className="p-3 rounded-full bg-muted mb-4"><Users className="h-8 w-8 text-muted-foreground" /></div>
                       <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum usuário encontrado</h3>
                       <p className="text-sm text-muted-foreground">Altere os filtros ou crie um novo usuário.</p>
                     </div>
                   </TableCell></TableRow>
                 ) : (
                  users.map((u: any) => (
                    <TableRow key={u.id}>
                       <TableCell className="font-medium">{u.name}</TableCell>
                       <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                       <TableCell>
                         <div className="flex flex-wrap gap-1">
                           {getUserRoles(u).length === 0
                             ? <span className="text-xs text-muted-foreground">Sem perfil</span>
                             : getUserRoles(u).map((r) => <Badge key={r.id} variant="secondary" className="text-[10px]">{r.name}</Badge>)}
                         </div>
                       </TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_access ? new Date(u.last_access).toLocaleString("pt-BR") : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Editar"><Edit className="h-4 w-4" /></Button>
                          {u.status === "active" && <Button variant="ghost" size="sm" onClick={() => toggleStatus(u, "inactive")} title="Inativar"><ShieldOff className="h-4 w-4" /></Button>}
                          {(u.status === "inactive" || u.status === "blocked") && <Button variant="ghost" size="sm" onClick={() => toggleStatus(u, "active")} title="Reativar"><ShieldCheck className="h-4 w-4" /></Button>}
                          <Button variant="ghost" size="sm" onClick={() => resetPassword(u)} title="Redefinir senha"><KeyRound className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => exportUserData(u)} title="Exportar dados (LGPD)"><Download className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => anonymizeUser(u)} title="Anonimizar (LGPD)"><UserMinus className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">{total} usuário(s) encontrado(s)</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {formError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              {!editingId && <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>}
              <div className="space-y-2"><Label>Cargo / Função</Label><Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data de início do vínculo</Label><Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Perfis de acesso</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate text-left">
                        {formData.roleIds.length === 0
                          ? "Selecione um ou mais perfis"
                          : roles
                              ?.filter((r) => formData.roleIds.includes(r.id))
                              .map((r) => r.name)
                              .join(", ") || `${formData.roleIds.length} selecionado(s)`}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                    <div className="space-y-1 max-h-64 overflow-auto">
                      {roles?.map((r) => {
                        const checked = formData.roleIds.includes(r.id);
                        return (
                          <label key={r.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setFormData({
                                  ...formData,
                                  roleIds: c
                                    ? [...formData.roleIds, r.id]
                                    : formData.roleIds.filter((id) => id !== r.id),
                                });
                              }}
                            />
                            <span className="text-sm">{r.name}</span>
                            {checked && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                          </label>
                        );
                      })}
                    </div>
                    {formData.roleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 border-t pt-2 mt-2">
                        {roles?.filter((r) => formData.roleIds.includes(r.id)).map((r) => (
                          <Badge key={r.id} variant="secondary" className="text-[10px]">{r.name}</Badge>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">As permissões serão a união de todos os perfis selecionados.</p>
              </div>
              <div className="space-y-2">
                <Label>Área principal</Label>
                <AreaCombobox
                  areas={areas as any}
                  value={formData.primaryAreaId}
                  onChange={handleAreaChange}
                />

                {formData.primaryAreaId !== "none" && getAreaPrimaryManager(formData.primaryAreaId) && (
                  <p className="text-xs text-muted-foreground">Gestor da área sugerido automaticamente abaixo.</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gestor direto</Label>
              <Select value={formData.directManagerId} onValueChange={(v) => setFormData({ ...formData, directManagerId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem gestor direto —</SelectItem>
                  {profiles?.filter((p: any) => p.user_id !== editingId && p.status === "active").map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} /></div>
            <p className="text-xs text-muted-foreground">
              Áreas adicionais (atuação em mais de uma unidade) são cadastradas pela tela Gestão de Áreas.
            </p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog open={tempPasswordDialog.open} onOpenChange={(o) => setTempPasswordDialog({ ...tempPasswordDialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Senha Temporária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">A senha temporária para <strong>{tempPasswordDialog.email}</strong> é:</p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <code className="flex-1 text-sm font-mono">{tempPasswordDialog.password}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(tempPasswordDialog.password); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">O usuário será obrigado a trocar a senha no primeiro acesso. Guarde esta senha e envie ao usuário de forma segura.</p>
          </div>
          <DialogFooter><Button onClick={() => setTempPasswordDialog({ open: false, password: "", email: "" })}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmAction.open} onOpenChange={(o) => setConfirmAction({ ...confirmAction, open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction.onConfirm(); setConfirmAction({ ...confirmAction, open: false }); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <UserImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
