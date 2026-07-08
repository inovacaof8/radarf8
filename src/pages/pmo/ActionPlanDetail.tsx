import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import ActionItemsPanel from "@/components/pmo/ActionItemsPanel";

export default function ActionPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();


  const { data: plan, isLoading } = useQuery({
    queryKey: ["action_plan", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: areas } = useQuery({
    queryKey: ["action_plan_areas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan_area")
        .select("id, is_primary, area:area_id(id, name, code)")
        .eq("action_plan_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["action_plan_members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plan_member")
        .select("id, role_in_plan, user_id")
        .eq("action_plan_id", id!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const patch: any = { status: newStatus };
      if (newStatus === "Concluído") patch.actual_end_date = new Date().toISOString().slice(0, 10);
      if (newStatus === "Reaberto") patch.actual_end_date = null;
      const { error } = await supabase.from("action_plan").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_data, newStatus) => {
      toast.success(newStatus === "Concluído" ? "Plano concluído" : "Plano reaberto");
      qc.invalidateQueries({ queryKey: ["action_plan", id] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar plano"),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!plan) return <div className="text-muted-foreground">Plano não encontrado.</div>;

  const isConcluded = plan.status === "Concluído";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" asChild size="sm">
          <Link to="/planos-acao"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link>
        </Button>
        {isConcluded ? (
          <Button
            variant="outline"
            onClick={() => updateStatus.mutate("Reaberto")}
            disabled={updateStatus.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Reabrir plano
          </Button>
        ) : (
          <Button
            onClick={() => updateStatus.mutate("Concluído")}
            disabled={updateStatus.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir plano
          </Button>
        )}
      </div>


      <PageHeader
        title={`${plan.code} — ${plan.title}`}
        description={plan.description || undefined}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
          <CardContent><Badge>{plan.status}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Prioridade</CardTitle></CardHeader>
          <CardContent><Badge variant="secondary">{plan.priority}</Badge></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Progresso</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{plan.progress}%</CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Objetivo</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{plan.objective || "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Justificativa</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{plan.justification || "—"}</CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Datas</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Início previsto: <strong>{plan.planned_start_date ? new Date(plan.planned_start_date).toLocaleDateString("pt-BR") : "—"}</strong></div>
            <div>Término previsto: <strong>{plan.planned_end_date ? new Date(plan.planned_end_date).toLocaleDateString("pt-BR") : "—"}</strong></div>
            <div>Início real: <strong>{plan.actual_start_date ? new Date(plan.actual_start_date).toLocaleDateString("pt-BR") : "—"}</strong></div>
            <div>Término real: <strong>{plan.actual_end_date ? new Date(plan.actual_end_date).toLocaleDateString("pt-BR") : "—"}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Origem</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div>Tipo: <strong>{plan.origin_type}</strong></div>
            {plan.origin_id && <div>ID: <code className="text-xs">{plan.origin_id}</code></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Áreas vinculadas</CardTitle></CardHeader>
        <CardContent>
          {!areas || areas.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma área vinculada.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {areas.map((a: any) => (
                <Badge key={a.id} variant={a.is_primary ? "default" : "secondary"}>
                  {a.area?.code ? `${a.area.code} — ` : ""}{a.area?.name}
                  {a.is_primary && " (principal)"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Participantes</CardTitle></CardHeader>
        <CardContent>
          {!members || members.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum participante vinculado.</div>
          ) : (
            <ul className="text-sm space-y-1">
              {members.map((m: any) => (
                <li key={m.id}>
                  <code className="text-xs">{m.user_id}</code> — {m.role_in_plan}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ActionItemsPanel planId={plan.id} />
        </CardContent>
      </Card>
    </div>
  );
}
