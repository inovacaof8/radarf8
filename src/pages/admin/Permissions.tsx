import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  export: "Exportar",
  admin: "Administrar",
  view_all: "Visão Global",
};
const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Usuários",
  roles: "Perfis",
  permissions: "Permissões",
  security: "Segurança",
  privacy: "Privacidade",
  "legal-documents": "Docs Legais",
  audit: "Auditoria",
  settings: "Configurações",
  modules: "Módulos",
  visual: "Visual",
  environment: "Ambiente",
  portfolio: "Portfólios",
  program: "Programas",
  project: "Projetos",
  ged: "GED",
  pdca: "PDCA",
  areas: "Áreas",
};

export default function PermissionsPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role");

  const { data: roles } = useQuery({
    queryKey: ["roles-for-perms"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("*").order("created_at");
      return data || [];
    },
  });

  const [selectedRole, setSelectedRole] = useState<string>("");

  useEffect(() => {
    if (roleParam) setSelectedRole(roleParam);
    else if (roles?.length && !selectedRole) setSelectedRole(roles[0].id);
  }, [roleParam, roles]);

  const { data: permissions } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: async () => {
      const { data } = await supabase.from("permissions").select("*");
      return data || [];
    },
  });

  const { data: rolePermissions, isLoading } = useQuery({
    queryKey: ["role-permissions", selectedRole],
    queryFn: async () => {
      if (!selectedRole) return [];
      const { data } = await supabase.from("role_permissions").select("permission_id").eq("role_id", selectedRole);
      return data?.map((rp) => rp.permission_id) || [];
    },
    enabled: !!selectedRole,
  });

  const modules = [...new Set(permissions?.map((p) => p.module) || [])];
  const actions = [...new Set(permissions?.map((p) => p.action) || [])];

  const getPerm = (module: string, action: string) => {
    return permissions?.find((p) => p.module === module && p.action === action);
  };

  const hasPerm = (module: string, action: string) => {
    const perm = getPerm(module, action);
    if (!perm) return false;
    return rolePermissions?.includes(perm.id) || false;
  };

  const togglePerm = async (module: string, action: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar permissões.");
      return;
    }
    const perm = getPerm(module, action);
    if (!perm || !selectedRole) return;
    const exists = rolePermissions?.includes(perm.id);
    const { error } = exists
      ? await supabase.from("role_permissions").delete().eq("role_id", selectedRole).eq("permission_id", perm.id)
      : await supabase.from("role_permissions").insert({ role_id: selectedRole, permission_id: perm.id });
    if (error) {
      toast.error("Falha ao atualizar permissão", { description: error.message });
      return;
    }
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      user_name: profile?.name || "",
      action: exists ? "permission_removed" : "permission_granted",
      module: "permissions",
      entity: "role_permission",
      details: `${exists ? "Removida" : "Concedida"} permissão ${action} em ${module}`,
    });
    toast.success(exists ? "Permissão removida" : "Permissão concedida");
    queryClient.invalidateQueries({ queryKey: ["role-permissions", selectedRole] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão de Permissões</h1>
        <p className="text-muted-foreground">Configure as permissões de cada perfil</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Perfil:</span>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {roles?.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="pt-6 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Módulo</th>
                  {actions.map((a) => (
                    <th key={a} className="text-center py-2 px-2 font-medium text-muted-foreground">
                      {ACTION_LABELS[a] || a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => (
                  <tr key={mod} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 pr-4 font-medium">{MODULE_LABELS[mod] || mod}</td>
                    {actions.map((action) => {
                      const permExists = !!getPerm(mod, action);
                      return (
                        <td key={action} className="text-center py-3 px-2">
                          {permExists ? (
                            <Checkbox
                              checked={hasPerm(mod, action)}
                              onCheckedChange={() => togglePerm(mod, action)}
                              disabled={!isAdmin}
                              title={!isAdmin ? "Somente administradores podem editar" : ""}
                            />
                          ) : (
                            <span
                              className="text-muted-foreground/30 font-medium select-none"
                              title="Permissão não aplicável para este módulo"
                            >
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
