import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";

export type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string | null;
  duracao_min: number | null;
  prioridade: "baixa" | "media" | "alta";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  origem: string;
  anotacoes: string | null;
  user_id?: string;
  created_by?: string | null;
  first_viewed_at?: string | null;
  assigned_at?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa?: TarefaRow | null;
  defaultDate?: string;
  defaultTitle?: string;
  defaultOrigem?: "manual" | "ia" | "reuniao" | "medicao" | "contrato";
};

export function TarefaDialog({
  open, onOpenChange, tarefa, defaultDate, defaultTitle, defaultOrigem = "manual",
}: Props) {
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!tarefa;
  const canAssign = hasAnyRole("Administrador", "PMO", "Gestor", "Diretor Geral");

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState<number>(30);
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [status, setStatus] = useState<TarefaRow["status"]>("pendente");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [erros, setErros] = useState<Record<string, string>>({});

  const { data: users = [] } = useSelectableUsers({ enabled: open && canAssign && !isEdit });

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
      setData(tarefa.data);
      setHora(tarefa.hora ?? "");
      setDuracao(tarefa.duracao_min ?? 30);
      setPrioridade(tarefa.prioridade);
      setStatus(tarefa.status);
      setAssigneeId(tarefa.user_id ?? user?.id ?? "");
    } else {
      setTitulo(defaultTitle ?? "");
      setDescricao("");
      setData(defaultDate ?? new Date().toISOString().slice(0, 10));
      setHora("");
      setDuracao(30);
      setPrioridade("media");
      setStatus("pendente");
      setAssigneeId(user?.id ?? "");
    }
    setErros({});
  }, [open, tarefa, defaultDate, defaultTitle, user?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      const e: Record<string, string> = {};
      if (!titulo.trim()) e.titulo = "Informe o título";
      if (!data) e.data = "Informe a data";
      setErros(e);
      if (Object.keys(e).length) throw new Error("validacao");
      if (!user) throw new Error("Não autenticado");

      const recipient = canAssign && !isEdit ? (assigneeId || user.id) : (tarefa?.user_id ?? user.id);

      const payload: any = {
        user_id: recipient,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        data,
        hora: hora || null,
        duracao_min: duracao || null,
        prioridade,
        status,
        origem: tarefa?.origem ?? defaultOrigem,
        concluida_em: status === "concluida" ? new Date().toISOString() : null,
      };

      if (isEdit && tarefa) {
        const { error } = await supabase.from("tarefas" as any).update(payload).eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tarefas" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const assignedToOther = canAssign && !isEdit && assigneeId && assigneeId !== user?.id;
      toast.success(
        isEdit ? "Tarefa atualizada"
          : assignedToOther ? "Tarefa atribuída e notificação enviada"
          : "Tarefa criada"
      );
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message !== "validacao") toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>Organize seu dia e acompanhe o que precisa ser feito.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={titulo}
              onChange={(e) => { setTitulo(e.target.value); if (erros.titulo) setErros({ ...erros, titulo: "" }); }}
              className={erros.titulo ? "border-destructive" : ""}
              placeholder="Ex: Revisar plano de ação" />
            {erros.titulo && <p className="text-xs text-destructive mt-1">{erros.titulo}</p>}
          </div>
          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} placeholder="Detalhes (opcional)" />
          </div>

          {canAssign && !isEdit && (
            <div>
              <Label>Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={user?.id ?? ""}>Eu mesmo</SelectItem>
                  {users
                    .filter((u) => u.user_id !== user?.id)
                    .map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.name}{u.email ? ` · ${u.email}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Atribuir a outro usuário envia uma notificação automática.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="data">Data *</Label>
              <Input id="data" type="date" value={data}
                onChange={(e) => { setData(e.target.value); if (erros.data) setErros({ ...erros, data: "" }); }}
                className={erros.data ? "border-destructive" : ""} />
              {erros.data && <p className="text-xs text-destructive mt-1">{erros.data}</p>}
            </div>
            <div>
              <Label htmlFor="hora">Hora</Label>
              <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="duracao">Duração (min)</Label>
              <Input id="duracao" type="number" min={5} step={5} value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && tarefa?.created_by && tarefa.user_id && tarefa.created_by !== tarefa.user_id && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p>
                Atribuída em {tarefa.assigned_at ? new Date(tarefa.assigned_at).toLocaleString("pt-BR") : "—"}.
              </p>
              <p>
                {tarefa.first_viewed_at
                  ? `Lida pelo responsável em ${new Date(tarefa.first_viewed_at).toLocaleString("pt-BR")}.`
                  : "Ainda não lida pelo responsável."}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
