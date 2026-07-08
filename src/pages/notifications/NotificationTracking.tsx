import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { NOTIF_ACK_STATUS } from "@/lib/notificationLabels";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Bell, Download } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

export default function NotificationTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: n } = useQuery({
    queryKey: ["notification", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ["notification-recipients", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_recipient")
        .select("*")
        .eq("notification_id", id!);
      if (error) throw error;
      const userIds = (data || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, email, primary_area_id")
        .in("user_id", userIds);
      const areaIds = Array.from(new Set((profs || []).map((p: any) => p.primary_area_id).filter(Boolean)));
      const { data: areas } = areaIds.length
        ? await supabase.from("area").select("id, name").in("id", areaIds)
        : { data: [] as any[] };
      const areaMap = new Map((areas || []).map((a: any) => [a.id, a.name]));
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, { ...p, area: { name: areaMap.get(p.primary_area_id) || null } }]));
      return (data || []).map((r: any) => ({ ...r, profile: profMap.get(r.user_id) }));
    },
  });

  const stats = useMemo(() => {
    const total = recipients.length;
    const delivered = recipients.filter((r: any) => r.delivery_status === "entregue").length;
    const viewed = recipients.filter((r: any) => r.first_viewed_at).length;
    const ack = recipients.filter((r: any) => r.acknowledgment_status === "ciencia_confirmada").length;
    const pending = recipients.filter((r: any) => ["nao_lida", "visualizada", "ciencia_pendente"].includes(r.acknowledgment_status)).length;
    const expired = recipients.filter((r: any) => r.acknowledgment_status === "ciencia_vencida").length;
    return { total, delivered, viewed, ack, pending, expired, pct: total ? Math.round((ack / total) * 100) : 0 };
  }, [recipients]);

  const remindMut = useMutation({
    mutationFn: async () => {
      const pendingIds = recipients.filter((r: any) => r.acknowledgment_status !== "ciencia_confirmada").map((r: any) => r.id);
      if (pendingIds.length === 0) throw new Error("Sem destinatários pendentes");
      const now = new Date().toISOString();
      // Update reminder count individually (need per-row)
      for (const r of recipients) {
        if (r.acknowledgment_status === "ciencia_confirmada") continue;
        await supabase.from("notification_recipient").update({
          reminder_count: (r.reminder_count || 0) + 1, last_reminder_at: now,
        }).eq("id", r.id);
      }
      await supabase.from("notification_reminder_log").insert({
        notification_id: id, sent_by: profile!.user_id, recipient_count: pendingIds.length,
        reminder_type: "manual", channel: "in_app",
      });
    },
    onSuccess: () => { toast.success("Lembretes enviados aos pendentes"); qc.invalidateQueries({ queryKey: ["notification-recipients", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = [["Nome", "Email", "Área", "Entrega", "Visualizado em", "Status ciência", "Confirmado em", "Dentro do prazo"]];
    recipients.forEach((r: any) => {
      const inDeadline = r.acknowledged_at && n?.acknowledgment_deadline
        ? new Date(r.acknowledged_at) <= new Date(n.acknowledgment_deadline) ? "Sim" : "Não" : "";
      rows.push([
        r.profile?.name || "",
        r.profile?.email || "",
        r.profile?.area?.name || "",
        r.delivery_status,
        r.first_viewed_at ? format(new Date(r.first_viewed_at), "dd/MM/yyyy HH:mm") : "",
        NOTIF_ACK_STATUS[r.acknowledgment_status],
        r.acknowledged_at ? format(new Date(r.acknowledged_at), "dd/MM/yyyy HH:mm") : "",
        inDeadline,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `notificacao-${n?.code || id}.csv`; a.click();
  };

  if (!n) return <p>Carregando…</p>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>

      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento — {n.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
            <Metric label="Total" value={stats.total} />
            <Metric label="Entregues" value={stats.delivered} />
            <Metric label="Visualizadas" value={stats.viewed} />
            <Metric label="Confirmadas" value={stats.ack} />
            <Metric label="Pendentes" value={stats.pending} />
            <Metric label="Vencidas" value={stats.expired} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1"><span>Percentual de confirmação</span><span className="font-medium">{stats.pct}%</span></div>
            <Progress value={stats.pct} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => remindMut.mutate()} variant="outline"><Bell className="h-4 w-4 mr-2" />Enviar lembrete aos pendentes</Button>
            <Button onClick={exportCsv} variant="outline"><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
            <Button onClick={() => window.print()} variant="outline"><Download className="h-4 w-4 mr-2" />Imprimir / PDF</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Destinatários</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>1ª visualização</TableHead>
                <TableHead>Ciência</TableHead>
                <TableHead>Confirmada em</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r: any) => {
                const inDeadline = r.acknowledged_at && n.acknowledgment_deadline
                  ? new Date(r.acknowledged_at) <= new Date(n.acknowledgment_deadline) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>{r.profile?.name}</div>
                      <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                    </TableCell>
                    <TableCell>{r.profile?.area?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.delivery_status}</Badge></TableCell>
                    <TableCell>{r.first_viewed_at ? format(new Date(r.first_viewed_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.acknowledgment_status === "ciencia_confirmada" ? "default" : r.acknowledgment_status === "ciencia_vencida" ? "destructive" : "outline"}>
                        {NOTIF_ACK_STATUS[r.acknowledgment_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.acknowledged_at ? format(new Date(r.acknowledged_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}</TableCell>
                    <TableCell>{inDeadline === null ? "—" : inDeadline ? <Badge variant="default">No prazo</Badge> : <Badge variant="destructive">Fora do prazo</Badge>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
