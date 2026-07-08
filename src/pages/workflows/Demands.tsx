import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Inbox, CheckCircle2 } from "lucide-react";
import { useDemands, useWorkflows } from "@/hooks/useWorkflows";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const statusColor: Record<string, string> = {
  open: "bg-slate-500",
  in_progress: "bg-blue-500",
  waiting_approval: "bg-amber-500",
  rejected: "bg-red-500",
  completed: "bg-emerald-500",
  cancelled: "bg-gray-400",
};
const statusLabel: Record<string, string> = {
  open: "Aberta",
  in_progress: "Em execução",
  waiting_approval: "Aguardando aprovação",
  rejected: "Rejeitada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export default function Demands() {
  const [creating, setCreating] = useState(false);
  const { hasPermission, isAdmin } = useAuth();
  const canCreate = isAdmin || hasPermission("workflows", "create");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6" /> Demandas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas demandas e aprovações pendentes.</p>
        </div>
        {canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />Nova demanda</Button>}
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">Minhas demandas</TabsTrigger>
          <TabsTrigger value="created">Criadas por mim</TabsTrigger>
          <TabsTrigger value="approvals"><CheckCircle2 className="h-4 w-4 mr-1" />Aguardando minha aprovação</TabsTrigger>
        </TabsList>
        <TabsContent value="mine"><DemandList filter="mine" /></TabsContent>
        <TabsContent value="created"><DemandList filter="created" /></TabsContent>
        <TabsContent value="approvals"><DemandList filter="approvals" /></TabsContent>
      </Tabs>

      {creating && <NewDemandDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function DemandList({ filter }: { filter: "mine" | "created" | "approvals" }) {
  const { data = [], isLoading } = useDemands(filter);
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhuma demanda.</p>;
  return (
    <div className="grid gap-2 mt-4">
      {data.map((d) => (
        <Link key={d.id} to={`/demandas/${d.id}`}>
          <Card className="hover:shadow transition">
            <CardContent className="p-4 flex items-center gap-3">
              <Badge variant="outline" className="font-mono">{d.code}</Badge>
              <div className="flex-1">
                <div className="font-medium">{d.title}</div>
                {d.due_at && <div className="text-xs text-muted-foreground">Prazo: {new Date(d.due_at).toLocaleString("pt-BR")}</div>}
              </div>
              <Badge className={statusColor[d.status]}>{statusLabel[d.status]}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function NewDemandDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: workflows = [] } = useWorkflows();
  const active = workflows.filter((w) => w.status === "active");
  const [workflowId, setWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!workflowId || !title.trim()) return toast.error("Selecione o workflow e informe o título");
    setSaving(true);
    try {
      const { error } = await supabase.from("workflow_demands").insert({
        workflow_id: workflowId, title, description, priority,
      } as any);
      if (error) throw error;
      toast.success("Demanda criada");
      qc.invalidateQueries({ queryKey: ["workflow_demands"] });
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova demanda</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Workflow</Label>
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{active.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
