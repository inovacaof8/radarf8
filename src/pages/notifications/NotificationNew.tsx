import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { NOTIF_TYPES, NOTIF_PRIORITIES } from "@/lib/notificationLabels";
import { toast } from "sonner";
import { useIsLeader } from "@/hooks/useIsLeader";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { ArrowLeft, Send } from "lucide-react";

export default function NotificationNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isLeader = useIsLeader();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("comunicado");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderFreq, setReminderFreq] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requiresAck, setRequiresAck] = useState(true);

  // Lista de destinatários selecionáveis conforme a área/visibilidade do usuário logado
  const { data: profiles = [] } = useSelectableUsers();

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-active"],
    queryFn: async () => {
      const { data } = await supabase.from("area").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["notif-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("notification_group").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ["notif-group-members", selectedGroups],
    enabled: selectedGroups.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("notification_group_member").select("group_id, user_id").in("group_id", selectedGroups).eq("status", "active");
      return data || [];
    },
  });

  const { data: areaMembers = [] } = useQuery({
    queryKey: ["area-members", selectedAreas],
    enabled: selectedAreas.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("user_area_membership").select("area_id, user_id").in("area_id", selectedAreas).eq("status", "active");
      return data || [];
    },
  });

  const finalRecipients = useMemo(() => {
    const ids = new Set<string>();
    selectedUsers.forEach((u) => ids.add(u));
    groupMembers.forEach((m: any) => ids.add(m.user_id));
    areaMembers.forEach((m: any) => ids.add(m.user_id));
    // Filter by scope and active profiles
    const validUserIds = new Set(profiles.map((p: any) => p.user_id));
    return Array.from(ids).filter((u) => validUserIds.has(u));
  }, [selectedUsers, groupMembers, areaMembers, profiles]);

  const send = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error("Título e mensagem obrigatórios");
      if (finalRecipients.length === 0) throw new Error("Selecione pelo menos um destinatário válido");

      const status = scheduledAt ? "agendada" : "enviada";
      const sentAt = scheduledAt ? null : new Date().toISOString();

      const { data: n, error } = await supabase
        .from("notification")
        .insert({
          title, message,
          notification_type: type as any,
          priority: priority as any,
          sender_user_id: profile!.user_id,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          acknowledgment_deadline: deadline ? new Date(deadline).toISOString() : null,
          status: status as any,
          requires_acknowledgment: requiresAck,
          reminder_enabled: reminderEnabled,
          reminder_frequency: reminderEnabled && reminderFreq ? reminderFreq as any : null,
          internal_notes: internalNotes || null,
          sent_at: sentAt,
        })
        .select()
        .single();
      if (error) throw error;

      // Create initial version
      await supabase.from("notification_version").insert({
        notification_id: n.id, version_number: 1, title, message, changed_by: profile!.user_id,
      });

      // Create recipients
      const rows = finalRecipients.map((uid) => ({
        notification_id: n.id,
        user_id: uid,
        delivery_status: status === "enviada" ? "entregue" : "pendente" as any,
        delivered_at: status === "enviada" ? new Date().toISOString() : null,
        acknowledgment_status: requiresAck ? "nao_lida" : "nao_lida" as any,
      }));
      const { error: rErr } = await supabase.from("notification_recipient").insert(rows);
      if (rErr) throw rErr;

      await supabase.from("notification_audit").insert({
        notification_id: n.id,
        user_id: profile!.user_id,
        action: "created_and_sent",
        new_data: { recipients: finalRecipients.length, status },
      });

      return n;
    },
    onSuccess: (n) => {
      toast.success("Notificação enviada");
      navigate(`/notificacoes/${n.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isLeader) {
    return (
      <Card><CardContent className="py-12 text-center">
        Você não tem permissão para criar notificações.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/notificacoes")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">Nova notificação</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Conteúdo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Mensagem *</Label>
            <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTIF_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(NOTIF_PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo para ciência</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label>Agendar envio (opcional)</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={requiresAck} onCheckedChange={(c) => setRequiresAck(!!c)} id="req-ack" />
            <Label htmlFor="req-ack">Exigir confirmação de ciência</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={reminderEnabled} onCheckedChange={(c) => setReminderEnabled(!!c)} id="reminders" />
            <Label htmlFor="reminders">Enviar lembretes para pendentes</Label>
            {reminderEnabled && (
              <Select value={reminderFreq} onValueChange={setReminderFreq}>
                <SelectTrigger className="w-40 ml-2"><SelectValue placeholder="Frequência" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Único</SelectItem>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="dois_dias">A cada 2 dias</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Observações internas</Label>
            <Textarea rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Destinatários</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Áreas</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-1">
              {areas.map((a: any) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedAreas.includes(a.id)}
                    onCheckedChange={(c) => setSelectedAreas(c ? [...selectedAreas, a.id] : selectedAreas.filter((x) => x !== a.id))}
                  />
                  {a.name}
                </label>
              ))}
              {areas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma área disponível.</p>}
            </div>
          </div>

          <div>
            <Label>Grupos</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-1">
              {groups.map((g: any) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedGroups.includes(g.id)}
                    onCheckedChange={(c) => setSelectedGroups(c ? [...selectedGroups, g.id] : selectedGroups.filter((x) => x !== g.id))}
                  />
                  {g.name}
                </label>
              ))}
              {groups.length === 0 && <p className="text-xs text-muted-foreground">Nenhum grupo cadastrado.</p>}
            </div>
          </div>

          <div>
            <Label>Usuários individuais (apenas os do seu escopo)</Label>
            <div className="border rounded-md p-2 max-h-60 overflow-auto space-y-1">
              {profiles.map((p: any) => (
                <label key={p.user_id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedUsers.includes(p.user_id)}
                    onCheckedChange={(c) => setSelectedUsers(c ? [...selectedUsers, p.user_id] : selectedUsers.filter((x) => x !== p.user_id))}
                  />
                  {p.name} <span className="text-muted-foreground text-xs">({p.email})</span>
                </label>
              ))}
              {profiles.length === 0 && <p className="text-xs text-muted-foreground">Nenhum usuário no seu escopo.</p>}
            </div>
          </div>

          <div className="bg-muted/40 p-3 rounded-md text-sm">
            <Badge variant="secondary">{finalRecipients.length}</Badge>
            <span className="ml-2">destinatário(s) únicos válidos após remover duplicados e usuários fora do escopo.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/notificacoes")}>Cancelar</Button>
        <Button onClick={() => setConfirmOpen(true)} disabled={send.isPending}>
          <Send className="h-4 w-4 mr-2" /> Enviar
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio</AlertDialogTitle>
            <AlertDialogDescription>
              A notificação será enviada para <strong>{finalRecipients.length}</strong> destinatário(s).
              {scheduledAt && " O envio acontecerá na data agendada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => send.mutate()}>Confirmar e enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
