import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { NOTIF_PRIORITY_COLORS, NOTIF_PRIORITIES, NOTIF_TYPES, NOTIF_STATUS } from "@/lib/notificationLabels";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Download, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function NotificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: n } = useQuery({
    queryKey: ["notification", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const { data: sender } = await supabase.from("profiles").select("name, email").eq("user_id", data.sender_user_id).maybeSingle();
      let area: any = null;
      if (data.sender_area_id) {
        const { data: a } = await supabase.from("area").select("name").eq("id", data.sender_area_id).maybeSingle();
        area = a;
      }
      return { ...data, sender, area } as any;
    },
  });

  const { data: recipient } = useQuery({
    queryKey: ["notification-recipient", id, profile?.user_id],
    enabled: !!id && !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_recipient")
        .select("*")
        .eq("notification_id", id!)
        .eq("user_id", profile!.user_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["notification-attachments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("notification_attachment").select("*").eq("notification_id", id!);
      return data || [];
    },
  });

  const isSender = profile?.user_id === n?.sender_user_id;

  // Mark as viewed on open
  useEffect(() => {
    if (!recipient || recipient.acknowledgment_status !== "nao_lida") return;
    const now = new Date().toISOString();
    supabase
      .from("notification_recipient")
      .update({
        acknowledgment_status: "visualizada",
        first_viewed_at: recipient.first_viewed_at || now,
        last_viewed_at: now,
      })
      .eq("id", recipient.id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notification-recipient", id] });
        qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      });
  }, [recipient?.id]); // eslint-disable-line

  const ackMutation = useMutation({
    mutationFn: async () => {
      if (!recipient) throw new Error("Sem registro");
      const now = new Date().toISOString();
      const afterDeadline = n?.acknowledgment_deadline ? new Date() > new Date(n.acknowledgment_deadline) : false;
      const { error } = await supabase
        .from("notification_recipient")
        .update({
          acknowledgment_status: "ciencia_confirmada",
          acknowledged_at: now,
          acknowledged_user_agent: navigator.userAgent,
          acknowledged_version: n?.current_version || 1,
          acknowledged_after_deadline: afterDeadline,
        })
        .eq("id", recipient.id);
      if (error) throw error;

      await supabase.from("notification_audit").insert({
        notification_id: id,
        user_id: profile!.user_id,
        action: "acknowledged",
        new_data: { version: n?.current_version, after_deadline: afterDeadline },
        user_agent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      toast.success("Ciência registrada com sucesso");
      qc.invalidateQueries({ queryKey: ["notification-recipient", id] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      qc.invalidateQueries({ queryKey: ["my-notifications"] });
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!n) return <p>Carregando…</p>;

  const isAck = recipient?.acknowledgment_status === "ciencia_confirmada";

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-xl">{n.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{n.code}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Badge variant="outline" className={NOTIF_PRIORITY_COLORS[n.priority]}>{NOTIF_PRIORITIES[n.priority]}</Badge>
              <Badge variant="secondary">{NOTIF_TYPES[n.notification_type]}</Badge>
              <Badge>{NOTIF_STATUS[n.status]}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Remetente:</span> {n.sender?.name || "—"}</div>
            <div><span className="text-muted-foreground">Área:</span> {n.area?.name || "—"}</div>
            <div><span className="text-muted-foreground">Enviada em:</span> {n.sent_at ? format(new Date(n.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</div>
            <div><span className="text-muted-foreground">Prazo para ciência:</span> {n.acknowledgment_deadline ? format(new Date(n.acknowledgment_deadline), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Sem prazo"}</div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Mensagem</h3>
            <div className="whitespace-pre-wrap text-sm">{n.message}</div>
          </div>

          {attachments.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Anexos</h3>
              <div className="space-y-2">
                {attachments.map((a: any) => (
                  <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Download className="h-4 w-4" /> {a.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {n.status === "cancelada" && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md text-sm">
              <strong>Notificação cancelada</strong>
              {n.cancellation_reason && <p className="mt-1">{n.cancellation_reason}</p>}
            </div>
          )}

          {recipient && n.requires_acknowledgment && n.status !== "cancelada" && (
            <div className="border-t pt-4">
              {isAck ? (
                <div className="bg-green-50 border border-green-300 text-green-800 p-3 rounded-md text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>
                    Ciência confirmada em {format(new Date(recipient.acknowledged_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {recipient.acknowledged_after_deadline && " (após o prazo)"}
                  </span>
                </div>
              ) : (
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="lg">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar ciência
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar ciência</AlertDialogTitle>
                      <AlertDialogDescription>
                        Declaro que tive acesso e tomei ciência do conteúdo desta notificação.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => ackMutation.mutate()}>Confirmar ciência</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}

          {isSender && (
            <div className="border-t pt-4">
              <Button variant="outline" onClick={() => navigate(`/notificacoes/${n.id}/acompanhamento`)}>
                <ListChecks className="h-4 w-4 mr-2" /> Acompanhar destinatários
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
