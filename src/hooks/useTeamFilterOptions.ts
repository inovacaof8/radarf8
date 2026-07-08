import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AreaOpt { id: string; name: string; acronym: string | null }
export interface PersonOpt { user_id: string; name: string; email: string | null; primary_area_id: string | null }

export function useTeamFilterOptions() {
  const { user, hasAnyRole } = useAuth();
  const uid = user?.id;
  const seesAll = hasAnyRole("Administrador", "PMO", "Diretor Geral");

  const areas = useQuery({
    queryKey: ["tf-areas", uid, seesAll],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<AreaOpt[]> => {
      if (seesAll) {
        const { data } = await supabase
          .from("area")
          .select("id, name, acronym")
          .eq("status", "active")
          .order("acronym", { ascending: true, nullsFirst: false });
        return (data || []) as AreaOpt[];
      }
      const { data: visible } = await supabase.rpc("user_visible_areas", { _user_id: uid! });
      const ids = (visible || []).map((v: any) => v.area_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("area")
        .select("id, name, acronym")
        .in("id", ids)
        .eq("status", "active");
      return (data || []) as AreaOpt[];
    },
  });

  const people = useQuery({
    queryKey: ["tf-people", uid, seesAll],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async (): Promise<PersonOpt[]> => {
      if (seesAll) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, name, email, primary_area_id")
          .eq("status", "active")
          .order("name");
        return (data || []).filter((p: any) => p.user_id) as PersonOpt[];
      }
      const { data: leadIds } = await supabase.rpc("user_leadership_user_ids", { _leader_id: uid! });
      const ids = Array.from(new Set([...(leadIds || []).map((r: any) => r.user_id), uid!]));
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, email, primary_area_id")
        .in("user_id", ids)
        .eq("status", "active")
        .order("name");
      return (data || []).filter((p: any) => p.user_id) as PersonOpt[];
    },
  });

  return { areas: areas.data || [], people: people.data || [], isLoading: areas.isLoading || people.isLoading };
}
