import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Conta tarefas pendentes/em andamento do usuário para hoje. */
export function useTarefasPendentesHoje() {
  const { user, hasAnyRole } = useAuth();
  const canSeeTeam = hasAnyRole("Administrador", "PMO", "Gestor", "Diretor Geral");
  return useQuery({
    queryKey: ["tarefas", "pendentes-hoje", user?.id, canSeeTeam],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const query = supabase
        .from("tarefas" as any)
        .select("id", { count: "exact", head: true })
        .eq("data", hoje)
        .in("status", ["pendente", "em_andamento"]);

      if (!canSeeTeam) query.eq("user_id", user!.id);

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
