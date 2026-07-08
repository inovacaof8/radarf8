import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NOTIF_PRIORITY_COLORS, NOTIF_PRIORITIES, NOTIF_TYPES, NOTIF_STATUS } from "@/lib/notificationLabels";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ListChecks, X, Archive } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function NotificationsSent() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: list = [] } = useQuery({
    queryKey: ["notifications-sent", profile?.user_id],
    enabled: !!profile?.user_id,
    queryFn: async () => {
      let q = supabase.from("notification").select("*").order("created_at", { ascending: false });
      if (!isAdmin) q = q.eq("sender_user_id", profile!.user_id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const cancelMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("notification").update({
        status: "cancelada",
        canceled_at: new Date().toISOString(),
        canceled_by: profile!.user_id,
        cancellation_reason: reason,
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("notification_audit").insert({
        notification_id: id, user_id: profile!.user_id, action: "canceled", new_data: { reason },
      });
    },
    onSuccess: () => { toast.success("Notificação cancelada"); qc.invalidateQueries({ queryKey: ["notifications-sent"] }); setCancelId(null); setReason(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification").update({
        status: "arquivada", archived_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Arquivada"); qc.invalidateQueries({ queryKey: ["notifications-sent"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/notificacoes")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">Notificações enviadas</h1>
      </div>

      {list.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma notificação enviada.</CardContent></Card>
      )}

      {list.map((n: any) => (
        <Card key={n.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">{n.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{n.code}</p>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline" className={NOTIF_PRIORITY_COLORS[n.priority]}>{NOTIF_PRIORITIES[n.priority]}</Badge>
                <Badge variant="secondary">{NOTIF_TYPES[n.notification_type]}</Badge>
                <Badge>{NOTIF_STATUS[n.status]}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex justify-between flex-wrap gap-2">
            <span>{n.sent_at ? `Enviada ${format(new Date(n.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : "Não enviada"}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/notificacoes/${n.id}/acompanhamento`)}>
                <ListChecks className="h-4 w-4 mr-1" /> Acompanhar
              </Button>
              {n.status === "enviada" && (
                <Button size="sm" variant="outline" onClick={() => setCancelId(n.id)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
              )}
              {n.status !== "arquivada" && (n.status === "cancelada" || n.status === "enviada") && (
                <Button size="sm" variant="outline" onClick={() => archiveMut.mutate(n.id)}>
                  <Archive className="h-4 w-4 mr-1" /> Arquivar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar notificação</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não exclui registros já confirmados. Informe a justificativa do cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div><Label>Justificativa</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={!reason.trim()} onClick={() => cancelId && cancelMut.mutate({ id: cancelId, reason })}>
              Cancelar notificação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
