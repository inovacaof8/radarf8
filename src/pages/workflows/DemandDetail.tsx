import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle2, XCircle, Send, RotateCw, Clock } from "lucide-react";
import { useDemand, useDemandHistory, useCompleteStep, useApproveDemand, useRejectDemand, useResubmitDemand, useWorkflowSteps } from "@/hooks/useWorkflows";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DemandAttachments } from "@/components/workflows/DemandAttachments";

const statusColor: Record<string, string> = {
  open: "bg-slate-500", in_progress: "bg-blue-500", waiting_approval: "bg-amber-500",
  rejected: "bg-red-500", completed: "bg-emerald-500", cancelled: "bg-gray-400",
};
const statusLabel: Record<string, string> = {
  open: "Aberta", in_progress: "Em execução", waiting_approval: "Aguardando aprovação",
  rejected: "Rejeitada", completed: "Concluída", cancelled: "Cancelada",
};
const actionLabel: Record<string, string> = {
  created: "Criada", assigned: "Atribuída", started: "Iniciada",
  submitted_for_approval: "Enviada para aprovação", approved: "Aprovada",
  rejected: "Rejeitada", advanced: "Avançou de etapa", completed: "Concluída", cancelled: "Cancelada",
};

export default function DemandDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: demand } = useDemand(id);
  const { data: history = [] } = useDemandHistory(id);
  const { data: steps = [] } = useWorkflowSteps(demand?.workflow_id);

  const complete = useCompleteStep();
  const approve = useApproveDemand();
  const reject = useRejectDemand();
  const resubmit = useResubmitDemand();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  const { data: names = {} } = useQuery({
    queryKey: ["user_names", id],
    enabled: !!demand,
    queryFn: async () => {
      const ids = new Set<string>();
      if (demand?.current_responsible_id) ids.add(demand.current_responsible_id);
      if (demand?.current_approver_id) ids.add(demand.current_approver_id);
      history.forEach((h: any) => { [h.actor_id, h.to_user_id, h.approver_id].forEach((x) => x && ids.add(x)); });
      if (ids.size === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id,name").in("user_id", Array.from(ids));
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.user_id] = p.name; });
      return map;
    },
  });

  if (!demand) return <div className="p-6">Carregando...</div>;

  const currentStep = steps.find((s) => s.id === demand.current_step_id);
  const isResponsible = demand.current_responsible_id === user?.id;
  const isApprover = demand.current_approver_id === user?.id;
  const canComplete = (isResponsible || isAdmin) && (demand.status === "open" || demand.status === "in_progress");
  const canApprove = (isApprover || isAdmin) && demand.status === "waiting_approval";
  const canResubmit = (isResponsible || isAdmin) && demand.status === "rejected";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <Badge variant="outline" className="font-mono">{demand.code}</Badge>
        <h1 className="text-xl font-bold flex-1">{demand.title}</h1>
        <Badge className={statusColor[demand.status]}>{statusLabel[demand.status]}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Etapa atual</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Ordem {currentStep?.order_index}</Badge>
            <span className="font-medium">{currentStep?.name}</span>
            {currentStep?.requires_approval && <Badge variant="outline" className="text-amber-700 border-amber-400">Requer aprovação</Badge>}
          </div>
          <div className="text-sm text-muted-foreground">
            Responsável: <b>{names[demand.current_responsible_id ?? ""] ?? "—"}</b>
            {demand.current_approver_id && <> · Aprovador: <b>{names[demand.current_approver_id] ?? "—"}</b></>}
          </div>
          {demand.due_at && (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Prazo: {new Date(demand.due_at).toLocaleString("pt-BR")}
            </div>
          )}
          {demand.description && <p className="text-sm pt-2 border-t">{demand.description}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <DemandAttachments demandId={demand.id} createdBy={demand.created_by} />
        </CardContent>
      </Card>


      <div className="flex flex-wrap gap-2">
        {canComplete && (
          <Button onClick={() => setCompleteOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            {currentStep?.requires_approval ? "Concluir e enviar para aprovação" : "Concluir etapa"}
          </Button>
        )}
        {canApprove && (
          <>
            <Button onClick={() => setCompleteOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />Aprovar
            </Button>
            <Button variant="destructive" onClick={() => setRejectOpen(true)}>
              <XCircle className="h-4 w-4 mr-2" />Rejeitar
            </Button>
          </>
        )}
        {canResubmit && (
          <Button variant="outline" onClick={() => resubmit.mutate(demand.id)}>
            <RotateCw className="h-4 w-4 mr-2" />Reabrir para retrabalho
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {history.map((h: any) => (
              <li key={h.id} className="border-l-2 pl-3 py-1">
                <div className="text-sm font-medium">{actionLabel[h.action] ?? h.action}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                  {h.actor_id && <> · por {names[h.actor_id] ?? "—"}</>}
                  {h.to_user_id && <> · para {names[h.to_user_id] ?? "—"}</>}
                </div>
                {h.comment && <div className="text-sm mt-1 bg-muted/50 rounded p-2">{h.comment}</div>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Complete / Approve dialog */}
      <Dialog open={completeOpen} onOpenChange={(v) => { setCompleteOpen(v); if (!v) setComment(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{canApprove ? "Aprovar demanda" : "Concluir etapa"}</DialogTitle></DialogHeader>
          <div>
            <Label>Comentário (opcional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (canApprove) await approve.mutateAsync({ id: demand.id, comment });
              else await complete.mutateAsync({ id: demand.id, comment });
              setCompleteOpen(false); setComment("");
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => { setRejectOpen(v); if (!v) setComment(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar demanda</DialogTitle></DialogHeader>
          <div>
            <Label>Motivo da rejeição <span className="text-destructive">*</span></Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!comment.trim()) return;
              await reject.mutateAsync({ id: demand.id, comment });
              setRejectOpen(false); setComment("");
            }}>Rejeitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
