import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsLeader() {
  const { profile, isAdmin } = useAuth();
  const { data } = useQuery({
    queryKey: ["is-leader", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      if (isAdmin) return true;
      const { data, error } = await supabase.rpc("is_leader", { _user_id: profile!.user_id });
      if (error) return false;
      return !!data;
    },
  });
  return !!data || isAdmin;
}
