import { useAuth } from "@/contexts/AuthContext";

/**
 * GED funciona como um "cofre" pessoal:
 * - Qualquer usuário autenticado pode usar (ver o módulo, criar documentos).
 * - O que ele vê dentro do módulo é restrito por RLS (dono + ACL + visão geral GED).
 * - Administrador/PMO/Diretor Geral podem inativar/excluir documentos.
 */
export function useGedAccess() {
  const { roles, user } = useAuth();
  const names = roles.map((r) => r.name);
  const has = (...allowed: string[]) => names.some((n) => allowed.includes(n));
  const canView = !!user;
  const canManage = !!user;
  const canDelete = has("Administrador", "PMO", "Diretor Geral");
  return { canView, canManage, canDelete, roleName: names[0] ?? "", roleNames: names };
}
