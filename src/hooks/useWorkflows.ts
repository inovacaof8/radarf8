import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type Workflow = {
  id: string;
  name: string;
  description: string | null;
  area_id: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type WorkflowStep = {
  id: string;
  workflow_id: string;
  order_index: number;
  name: string;
  description: string | null;
  sla_hours: number;
  default_responsible_type: "user" | "area_manager" | "creator" | "previous_step";
  default_responsible_user_id: string | null;
  default_responsible_area_id: string | null;
  requires_approval: boolean;
  approver_type: "user" | "area_manager" | "configured" | null;
  approver_user_id: string | null;
  approver_area_id: string | null;
};

export type WorkflowDemand = {
  id: string;
  code: string | null;
  workflow_id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  current_step_id: string | null;
  current_responsible_id: string | null;
  current_approver_id: string | null;
  due_at: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Workflow[];
    },
  });
}

export function useWorkflowSteps(workflowId: string | undefined) {
  return useQuery({
    queryKey: ["workflow_steps", workflowId],
    enabled: !!workflowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_steps")
        .select("*")
        .eq("workflow_id", workflowId!)
        .order("order_index");
      if (error) throw error;
      return data as WorkflowStep[];
    },
  });
}

export function useDemands(filter: "mine" | "created" | "approvals" | "all" = "mine") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["workflow_demands", filter, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from("workflow_demands").select("*").order("created_at", { ascending: false });
      if (filter === "mine") q = q.or(`current_responsible_id.eq.${user!.id},created_by.eq.${user!.id}`);
      else if (filter === "created") q = q.eq("created_by", user!.id);
      else if (filter === "approvals") q = q.eq("current_approver_id", user!.id).eq("status", "waiting_approval");
      const { data, error } = await q;
      if (error) throw error;
      return data as WorkflowDemand[];
    },
  });
}

export function useDemand(id: string | undefined) {
  return useQuery({
    queryKey: ["workflow_demand", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_demands").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as WorkflowDemand | null;
    },
  });
}

export function useDemandHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["workflow_history", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_demand_history")
        .select("*")
        .eq("demand_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCompleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { error } = await supabase.rpc("workflow_complete_step", {
        _demand_id: id,
        _comment: comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa concluída");
      qc.invalidateQueries({ queryKey: ["workflow_demand"] });
      qc.invalidateQueries({ queryKey: ["workflow_demands"] });
      qc.invalidateQueries({ queryKey: ["workflow_history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useApproveDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { error } = await supabase.rpc("workflow_approve", {
        _demand_id: id,
        _comment: comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda aprovada");
      qc.invalidateQueries({ queryKey: ["workflow_demand"] });
      qc.invalidateQueries({ queryKey: ["workflow_demands"] });
      qc.invalidateQueries({ queryKey: ["workflow_history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useRejectDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
      const { error } = await supabase.rpc("workflow_reject", { _demand_id: id, _comment: comment });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda rejeitada");
      qc.invalidateQueries({ queryKey: ["workflow_demand"] });
      qc.invalidateQueries({ queryKey: ["workflow_demands"] });
      qc.invalidateQueries({ queryKey: ["workflow_history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useResubmitDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("workflow_resubmit", { _demand_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda reaberta");
      qc.invalidateQueries({ queryKey: ["workflow_demand"] });
      qc.invalidateQueries({ queryKey: ["workflow_demands"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}
