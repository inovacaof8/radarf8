import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { NOTIF_PRIORITY_COLORS, NOTIF_PRIORITIES, NOTIF_TYPES, NOTIF_ACK_STATUS } from "@/lib/notificationLabels";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Send, Inbox } from "lucide-react";
import { useIsLeader } from "@/hooks/useIsLeader";

type Tab = "todas" | "nao_lidas" | "pendente" | "confirmada" | "vencidas" | "arquivadas";

export default function NotificationsCenter() {
  const { profile } = useAuth();
  const isLeader = useIsLeader();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("todas");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["my-notifications", profile?.user_id, tab],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      let q = supabase
        .from("notification_recipient")
        .select("*, notification:notification_id(*)")
        .eq("user_id", profile!.user_id)
        .order("created_at", { ascending: false });

      if (tab === "nao_lidas") q = q.in("acknowledgment_status", ["nao_lida"]);
      else if (tab === "pendente") q = q.in("acknowledgment_status", ["nao_lida", "visualizada", "ciencia_pendente"]);
      else if (tab === "confirmada") q = q.eq("acknowledgment_status", "ciencia_confirmada");
      else if (tab === "vencidas") q = q.eq("acknowledgment_status", "ciencia_vencida");

      const { data, error } = await q;
      if (error) throw error;
      let rows = data || [];
      if (tab === "arquivadas") {
        rows = rows.filter((r: any) => r.notification?.archived_at);
      } else {
        rows = rows.filter((r: any) => !r.notification?.archived_at);
      }
      // Attach sender names
      const senderIds = Array.from(new Set(rows.map((r: any) => r.notification?.sender_user_id).filter(Boolean)));
      if (senderIds.length > 0) {
        const { data: senders } = await supabase.from("profiles").select("user_id, name").in("user_id", senderIds);
        const map = new Map((senders || []).map((s: any) => [s.user_id, s.name]));
        rows = rows.map((r: any) => ({ ...r, notification: { ...r.notification, sender: { name: map.get(r.notification.sender_user_id) } } }));
      }
      return rows;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Central de Notificações</h1>
          <p className="text-sm text-muted-foreground">Comunicados recebidos e suas confirmações de ciência</p>
        </div>
        <div className="flex gap-2">
          {isLeader && (
            <>
              <Button variant="outline" onClick={() => navigate("/notificacoes/enviadas")}>
                <Send className="h-4 w-4 mr-2" /> Enviadas
              </Button>
              <Button onClick={() => navigate("/notificacoes/nova")}>
                <Plus className="h-4 w-4 mr-2" /> Nova notificação
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="nao_lidas">Não lidas</TabsTrigger>
          <TabsTrigger value="pendente">Ciência pendente</TabsTrigger>
          <TabsTrigger value="confirmada">Ciência confirmada</TabsTrigger>
          <TabsTrigger value="vencidas">Vencidas</TabsTrigger>
          <TabsTrigger value="arquivadas">Arquivadas</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && items.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Nenhuma notificação nesta aba.
              </CardContent>
            </Card>
          )}
          {items.map((r: any) => {
            const n = r.notification;
            if (!n) return null;
            const unread = r.acknowledgment_status === "nao_lida";
            return (
              <Card
                key={r.id}
                className={`cursor-pointer hover:bg-muted/40 transition ${unread ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => navigate(`/notificacoes/${n.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base">{n.title}</CardTitle>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className={NOTIF_PRIORITY_COLORS[n.priority]}>
                        {NOTIF_PRIORITIES[n.priority]}
                      </Badge>
                      <Badge variant="secondary">{NOTIF_TYPES[n.notification_type]}</Badge>
                      <Badge variant={r.acknowledgment_status === "ciencia_confirmada" ? "default" : r.acknowledgment_status === "ciencia_vencida" ? "destructive" : "outline"}>
                        {NOTIF_ACK_STATUS[r.acknowledgment_status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">
                  <div className="flex justify-between flex-wrap gap-2">
                    <span>De: {n.sender?.name || "—"}</span>
                    <span>
                      Enviada: {n.sent_at ? format(new Date(n.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      {n.acknowledgment_deadline && ` · Prazo: ${format(new Date(n.acknowledgment_deadline), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
