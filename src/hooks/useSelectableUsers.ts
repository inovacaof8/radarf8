import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SelectableUser {
  user_id: string;
  name: string;
  email: string | null;
  primary_area_id?: string | null;
}

interface Options {
  /**
   * Quando true (telas de reunião), Gestor/Admin/PMO podem selecionar
   * qualquer usuário ativo do sistema (cross-área).
   */
  forMeeting?: boolean;
  /** Desabilita a consulta. */
  enabled?: boolean;
}

/**
 * Lista de usuários que o usuário logado pode escolher em seletores
 * (responsável por tarefa, equipe de projeto, plano de ação, etc.).
 *
 * Regras:
 * - Administrador / PMO: sempre veem todos os usuários ativos.
 * - Demais perfis: veem somente usuários que compartilham alguma área
 *   com o solicitante (área que ele gerencia OU em que é membro).
 * - Usuários sem área aparecem apenas para Administrador/PMO.
 * - Em telas de reunião (forMeeting=true), Gestor também vê todos.
 */
export function useSelectableUsers(opts: Options = {}) {
  const { user, hasAnyRole } = useAuth();
  const uid = user?.id;
  const isAdminOrPmo = hasAnyRole("Administrador", "PMO", "Diretor Geral");
  const isGestor = hasAnyRole("Gestor");
  const seesEveryone = isAdminOrPmo || (opts.forMeeting === true && isGestor);

  return useQuery({
    queryKey: ["selectable-users", uid, seesEveryone, !!opts.forMeeting],
    enabled: !!uid && opts.enabled !== false,
    staleTime: 60_000,
    queryFn: async (): Promise<SelectableUser[]> => {
      if (seesEveryone) {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, name, email, primary_area_id")
          .eq("status", "active")
          .order("name");
        if (error) throw error;
        return (data || []).filter((p: any) => p.user_id) as SelectableUser[];
      }
      const { data: ids, error: idsErr } = await supabase.rpc("users_visible_to", {
        _user_id: uid!,
      });
      if (idsErr) throw idsErr;
      const userIds = Array.from(
        new Set([...(ids || []).map((r: any) => r.user_id), uid!]),
      );
      if (!userIds.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, email, primary_area_id")
        .in("user_id", userIds)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.user_id) as SelectableUser[];
    },
  });
}
