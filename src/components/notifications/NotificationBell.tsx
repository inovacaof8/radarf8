import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function NotificationBell() {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const { data: count = 0, refetch } = useQuery({
    queryKey: ["notif-unread-count", profile?.user_id],
    enabled: isAuthenticated && !!profile?.user_id,
    queryFn: async () => {
      const { count } = await supabase
        .from("notification_recipient")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.user_id)
        .in("acknowledgment_status", ["nao_lida", "ciencia_pendente", "ciencia_vencida"]);
      return count || 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!profile?.user_id) return;
    const ch = supabase
      .channel("notif-bell-" + profile.user_id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_recipient", filter: `user_id=eq.${profile.user_id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id, refetch]);

  return (
    <Button variant="ghost" size="sm" onClick={() => navigate("/notificacoes")} className="relative" aria-label="Notificações">
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px]">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Button>
  );
}
