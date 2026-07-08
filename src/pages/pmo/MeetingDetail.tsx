import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sparkles, ArrowLeft, Plus, Trash2, Save, Pencil, FileDown } from "lucide-react";
import AudioRecorder from "@/components/pmo/AudioRecorder";
import MeetingFileImporter from "@/components/pmo/MeetingFileImporter";
import ActionItemEditDialog from "@/components/pmo/ActionItemEditDialog";
import { exportMeetingPdf } from "@/lib/meetingPdf";
import { toast } from "sonner";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "destructive",
  media: "secondary",
  baixa: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const localISO = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeGeneratedDueDate = (value?: string | null) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const today = localISO();
  const currentYear = new Date().getFullYear();
  const year = Number(match[1]);
  if (year < currentYear && `${currentYear}-${match[2]}-${match[3]}` >= today) {
    return `${currentYear}-${match[2]}-${match[3]}`;
  }
  return trimmed;
};

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const highlightId = location.hash.startsWith("#ai-") ? location.hash.slice(4) : null;
  const qc = useQueryClient();
  const [rawInput, setRawInput] = useState("");
  const [mode, setMode] = useState<"transcricao" | "bullets">("transcricao");
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("atividades");
  const [tabUserSet, setTabUserSet] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const meeting = useQuery({
    queryKey: ["meeting", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const minute = useQuery({
    queryKey: ["meeting-minute", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_minute").select("*").eq("meeting_id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const actionItems = useQuery({
    queryKey: ["meeting-actions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_item")
        .select("*")
        .eq("meeting_id", id!);
      if (error) throw error;
      const statusOrder: Record<string, number> = { pendente: 0, em_andamento: 1, bloqueada: 2, concluida: 3, cancelada: 4 };
      return (data || []).slice().sort((a: any, b: any) => {
        const sa = statusOrder[a.status] ?? 99;
        const sb = statusOrder[b.status] ?? 99;
        if (sa !== sb) return sa - sb;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    },
    enabled: !!id,
  });

  const profiles = useSelectableUsers({ forMeeting: true });

  const participants = useQuery({
    queryKey: ["meeting-participants", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participant")
        .select("id, user_id, role_in_meeting")
        .eq("meeting_id", id!);
      if (error) throw error;
      return data || [];
    },
  });

  const addParticipant = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase
        .from("meeting_participant")
        .insert({ meeting_id: id!, user_id: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Participante adicionado");
      qc.invalidateQueries({ queryKey: ["meeting-participants", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeParticipant = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_participant").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting-participants", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Sugere a aba certa de acordo com o estado: se não há ata nem atividades,
  // abre o "Gerar". Caso contrário, mantém em "Atividades" (padrão).
  useEffect(() => {
    if (tabUserSet) return;
    const hasMinute = !!minute.data?.formatted_content;
    const hasItems = (actionItems.data?.length ?? 0) > 0;
    if (!hasMinute && !hasItems) {
      setActiveTab("gerar");
    } else {
      setActiveTab("atividades");
    }
  }, [minute.data?.formatted_content, actionItems.data?.length, tabUserSet]);

  // Se vier com hash #ai-<id>, abre a aba de atividades e rola até o item
  useEffect(() => {
    if (!highlightId || !actionItems.data) return;
    setActiveTab("atividades");
    const t = setTimeout(() => {
      const el = document.getElementById(`ai-${highlightId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [highlightId, actionItems.data]);

  const findUserIdByHint = (hint?: string) => {
    if (!hint || !profiles.data) return null;
    const lower = hint.toLowerCase().trim();
    const match = profiles.data.find(
      (p: any) =>
        (p.email && p.email.toLowerCase() === lower) ||
        (p.name && p.name.toLowerCase().includes(lower)),
    );
    return match?.user_id ?? null;
  };

  const runGeneration = async (sourceText: string, sourceMode: "transcricao" | "bullets") => {
    if (sourceText.trim().length < 10) {
      toast.error("Conteúdo muito curto (mínimo 10 caracteres).");
      return;
    }
    setGenerating(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("generate-meeting-minutes", {
        body: {
          raw_input: sourceText,
          mode: sourceMode,
          meeting_context: {
            title: meeting.data?.title,
            scheduled_at: meeting.data?.scheduled_at,
            agenda: meeting.data?.agenda,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const minutePayload = {
        meeting_id: id!,
        raw_input: sourceText,
        generation_mode: sourceMode,
        formatted_content: data.formatted_content,
        ai_model: data.model,
        status: "rascunho",
        generated_at: new Date().toISOString(),
        generated_by: u.user?.id,
      };
      const { error: upErr } = await supabase
        .from("meeting_minute")
        .upsert(minutePayload, { onConflict: "meeting_id" });
      if (upErr) throw upErr;

      // Resolve assignees: tenta casar com profiles existentes; se não houver match,
      // provisiona um usuário com apenas o nome (faltando completar os demais dados).
      const rawItems = (data.action_items ?? []) as any[];
      const unresolvedHints = Array.from(
        new Set(
          rawItems
            .map((ai) => (ai.assignee_email_hint || "").trim())
            .filter((h) => h && !findUserIdByHint(h)),
        ),
      );

      const hintToUserId = new Map<string, string>();
      let provisionedCount = 0;
      if (unresolvedHints.length) {
        const provItems = unresolvedHints.map((h) => {
          const isEmail = /\S+@\S+\.\S+/.test(h);
          return isEmail ? { name: h.split("@")[0], email: h } : { name: h };
        });
        const { data: provData, error: provErr } = await supabase.functions.invoke(
          "provision-provisional-user",
          { body: { items: provItems } },
        );
        if (provErr) console.error("Provisionamento falhou", provErr);
        const results = (provData?.results ?? []) as { name: string; email: string; user_id: string; created: boolean }[];
        unresolvedHints.forEach((h, idx) => {
          const r = results[idx];
          if (r?.user_id) {
            hintToUserId.set(h, r.user_id);
            if (r.created) provisionedCount++;
          }
        });
        if (provisionedCount > 0) {
          await qc.invalidateQueries({ queryKey: ["profiles-lookup"] });
        }
      }

      const items = rawItems.map((ai: any) => {
        const hint = (ai.assignee_email_hint || "").trim();
        const matched = findUserIdByHint(hint) || hintToUserId.get(hint) || null;
        return {
          meeting_id: id!,
          title: ai.title,
          description: ai.description ?? null,
          assignee_id: matched,
          assignee_email_hint: ai.assignee_email_hint || null,
          due_date: normalizeGeneratedDueDate(ai.due_date),
          priority: ai.priority ?? "media",
          status: "pendente",
        };
      });
      if (items.length) {
        const { error: aiErr } = await supabase.from("meeting_action_item").insert(items);
        if (aiErr) throw aiErr;
      }

      const extra = provisionedCount > 0 ? ` (${provisionedCount} usuário(s) provisório(s) criado(s))` : "";
      toast.success(`Ata gerada e ${items.length} pendência(s) salva(s)${extra}.`);
      setRawInput("");
      qc.invalidateQueries({ queryKey: ["meeting-minute", id] });
      qc.invalidateQueries({ queryKey: ["meeting-actions", id] });
      // Leva o usuário direto para a aba de Atividades, onde as pendências aparecem
      setTabUserSet(true);
      setActiveTab("atividades");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar ata");
    } finally {
      setGenerating(false);
    }
  };

  const generate = () => runGeneration(rawInput, mode);

  const handleImported = (text: string) => {
    setRawInput((prev) => (prev ? prev + "\n\n" : "") + text);
    setMode("transcricao");
    // Geração automática conforme escolha do usuário
    runGeneration(text, "transcricao");
  };

  const updateAction = useMutation({
    mutationFn: async ({ aid, patch }: { aid: string; patch: any }) => {
      const { error } = await supabase.from("meeting_action_item").update(patch).eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting-actions", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAction = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("meeting_action_item").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade removida");
      qc.invalidateQueries({ queryKey: ["meeting-actions", id] });
    },
  });

  const addManualAction = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("meeting_action_item").insert({ ...payload, meeting_id: id! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atividade adicionada");
      qc.invalidateQueries({ queryKey: ["meeting-actions", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const promoteToTask = useMutation({
    mutationFn: async (item: any) => {
      if (!meeting.data?.project_id) throw new Error("Reunião não está vinculada a um projeto.");
      const { data, error } = await supabase
        .from("task")
        .insert({
          project_id: meeting.data.project_id,
          name: item.title,
          description: item.description,
          assignee_id: item.assignee_id,
          end_date: item.due_date,
          status: "backlog",
          priority: item.priority,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("meeting_action_item")
        .update({ promoted_to_task_id: data.id })
        .eq("id", item.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Atividade promovida a tarefa do projeto");
      qc.invalidateQueries({ queryKey: ["meeting-actions", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (meeting.isLoading) return <Skeleton className="h-64" />;
  if (!meeting.data) return <div className="p-6">Reunião não encontrada.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/reunioes")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportMeetingPdf({
              meeting: meeting.data,
              minute: minute.data,
              actions: actionItems.data ?? [],
              profiles: profiles.data ?? [],
              participants: participants.data ?? [],
            })
          }
        >
          <FileDown className="mr-2 h-4 w-4" /> Exportar ata + ações (PDF)
        </Button>
      </div>

      <PageHeader
        title={meeting.data.title}
        description={`${format(new Date(meeting.data.scheduled_at), "PPPp", { locale: ptBR })} • ${meeting.data.modality}`}
      />

      <MeetingEditCard meeting={meeting.data} onSaved={() => qc.invalidateQueries({ queryKey: ["meeting", id] })} />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Gestor das pendências
          </Label>
          <Select
            value={meeting.data.manager_id ?? meeting.data.created_by ?? ""}
            onValueChange={async (v) => {
              const { error } = await supabase.from("meeting").update({ manager_id: v }).eq("id", id!);
              if (error) toast.error(error.message);
              else {
                toast.success("Gestor atualizado");
                qc.invalidateQueries({ queryKey: ["meeting", id] });
              }
            }}
          >
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((p: any) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Quem gerencia recebe as pendências em "Meu trabalho" e pode editar a reunião.
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Participantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(participants.data ?? []).length === 0 ? (
              <span className="text-sm text-muted-foreground">Nenhum participante vinculado.</span>
            ) : (
              (participants.data ?? []).map((p: any) => {
                const prof = (profiles.data ?? []).find((x: any) => x.user_id === p.user_id);
                return (
                  <Badge key={p.id} variant="secondary" className="gap-2 py-1 pl-2.5 pr-1">
                    {prof?.name || p.user_id}
                    <button
                      type="button"
                      className="rounded-sm hover:bg-destructive/20 p-0.5"
                      onClick={() => removeParticipant.mutate(p.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value=""
              onValueChange={(v) => {
                if (!v) return;
                if ((participants.data ?? []).some((p: any) => p.user_id === v)) {
                  toast.info("Esse usuário já é participante");
                  return;
                }
                addParticipant.mutate(v);
              }}
            >
              <SelectTrigger className="w-[320px]"><SelectValue placeholder="Adicionar participante…" /></SelectTrigger>
              <SelectContent>
                {(profiles.data ?? [])
                  .filter((p: any) => !(participants.data ?? []).some((x: any) => x.user_id === p.user_id))
                  .map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              Participantes vêem a reunião em "Meu trabalho".
            </span>
          </div>
        </CardContent>
      </Card>

      {meeting.data.agenda && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pauta</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{meeting.data.agenda}</CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setTabUserSet(true); setActiveTab(v); }}>
        <TabsList>
          <TabsTrigger value="gerar">
            <Sparkles className="mr-2 h-4 w-4" /> Gerar ata com IA
          </TabsTrigger>
          <TabsTrigger value="ata">Ata</TabsTrigger>
          <TabsTrigger value="atividades">
            Atividades {actionItems.data?.length ? `(${actionItems.data.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Entrada</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Modo</Label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transcricao">Transcrição / texto bruto</SelectItem>
                    <SelectItem value="bullets">Tópicos / bullets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Importar ata existente
                </Label>
                <MeetingFileImporter onExtracted={(text) => handleImported(text)} disabled={generating} />
                <p className="text-xs text-muted-foreground">
                  Suba uma ata em DOCX ou PDF. O sistema extrai o texto, gera a ata formatada e cria as pendências automaticamente.
                </p>
              </div>
              {mode === "transcricao" && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Capturar áudio da reunião
                  </Label>
                  <AudioRecorder
                    onTranscribed={(text) =>
                      setRawInput((prev) => (prev ? prev + "\n\n" : "") + text)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Grave pelo microfone do navegador. A transcrição será adicionada ao campo abaixo.
                  </p>
                </div>
              )}
              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  rows={14}
                  placeholder={
                    mode === "bullets"
                      ? "- Decisão sobre cronograma\n- João vai entregar relatório até 10/05\n- Próxima reunião dia 15"
                      : "Cole aqui a transcrição ou anotações da reunião — ou use o botão de gravar acima…"
                  }
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </div>
              <Button onClick={generate} disabled={generating}>
                <Sparkles className="mr-2 h-4 w-4" />
                {generating ? "Gerando…" : "Gerar ata e atividades"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ata">
          <MinuteEditor meetingId={id!} minute={minute.data} onSaved={() => qc.invalidateQueries({ queryKey: ["meeting-minute", id] })} />
        </TabsContent>

        <TabsContent value="atividades" className="space-y-4">
          <ManualActionForm onAdd={(p) => addManualAction.mutate(p)} profiles={profiles.data ?? []} />

          <Card>
            <CardContent className="p-0">
              {(actionItems.data ?? []).length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Nenhuma atividade.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.data!.map((a: any) => {
                      const assignee = profiles.data?.find((p: any) => p.user_id === a.assignee_id);
                      const overdue = a.due_date && a.due_date < localISO() && a.status !== "concluida" && a.status !== "cancelada";
                      return (
                        <TableRow
                          key={a.id}
                          id={`ai-${a.id}`}
                          className={highlightId === a.id ? "bg-primary/10" : overdue ? "bg-destructive/5" : ""}
                        >
                          <TableCell>
                            <div className="font-medium">{a.title}</div>
                            {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                            {a.promoted_to_task_id && (
                              <Badge variant="outline" className="mt-1">Tarefa do projeto</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {assignee ? assignee.name : a.assignee_external_name || a.assignee_email_hint || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className={`text-sm ${overdue ? "text-destructive font-semibold" : ""}`}>
                            {a.due_date ? format(new Date(`${a.due_date}T12:00:00`), "dd/MM/yyyy") : "—"}
                            {overdue && <span className="ml-1 text-[10px] uppercase">atrasada</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_COLOR[a.priority] as any}>{a.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Select value={a.status} onValueChange={(v) => updateAction.mutate({ aid: a.id, patch: { status: v } })}>
                              <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                                  <SelectItem key={v} value={v}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditItem(a)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {meeting.data.project_id && !a.promoted_to_task_id && (
                              <Button size="sm" variant="outline" onClick={() => promoteToTask.mutate(a)}>
                                Vincular ao projeto
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => deleteAction.mutate(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ActionItemEditDialog
        open={!!editItem}
        onOpenChange={(v) => !v && setEditItem(null)}
        item={editItem}
        profiles={profiles.data ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["meeting-actions", id] })}
      />
    </div>
  );
}

function ManualActionForm({ onAdd, profiles }: { onAdd: (p: any) => void; profiles: any[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Adicionar atividade manual
      </Button>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            const aid = fd.get("assignee_id");
            const ext = (fd.get("assignee_external_name") as string | null)?.trim() || null;
            onAdd({
              title: fd.get("title"),
              description: fd.get("description") || null,
              assignee_id: aid && aid !== "none" ? aid : null,
              assignee_external_name: aid && aid !== "none" ? null : ext,
              due_date: fd.get("due_date") || null,
              priority: fd.get("priority") || "media",
              status: "pendente",
            });
            (e.currentTarget as HTMLFormElement).reset();
            setOpen(false);
          }}
        >
          <div className="md:col-span-2"><Label>Título *</Label><Input name="title" required /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea name="description" rows={2} /></div>
          <div>
            <Label>Responsável</Label>
            <Select name="assignee_id" defaultValue="none">
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— ou externo abaixo —</SelectItem>
                {profiles.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável externo</Label>
            <Input name="assignee_external_name" placeholder="Nome livre (se não for usuário)" />
          </div>
          <div><Label>Prazo</Label><Input type="date" name="due_date" /></div>
          <div>
            <Label>Prioridade</Label>
            <Select name="priority" defaultValue="media">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit"><Save className="mr-2 h-4 w-4" /> Adicionar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingEditCard({ meeting, onSaved }: { meeting: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: meeting.title ?? "",
    scheduled_at: toLocalDatetimeInput(meeting.scheduled_at),
    duration_minutes: meeting.duration_minutes ?? 60,
    modality: meeting.modality ?? "online",
    location: meeting.location ?? "",
    status: meeting.status ?? "agendada",
    agenda: meeting.agenda ?? "",
  });

  useEffect(() => {
    setForm({
      title: meeting.title ?? "",
      scheduled_at: toLocalDatetimeInput(meeting.scheduled_at),
      duration_minutes: meeting.duration_minutes ?? 60,
      modality: meeting.modality ?? "online",
      location: meeting.location ?? "",
      status: meeting.status ?? "agendada",
      agenda: meeting.agenda ?? "",
    });
  }, [meeting.id]);

  const STATUS: Record<string, string> = {
    agendada: "Agendada",
    realizada: "Realizada",
    cancelada: "Cancelada",
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("meeting")
      .update({
        title: form.title,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 60,
        modality: form.modality,
        location: form.location || null,
        status: form.status,
        agenda: form.agenda || null,
      })
      .eq("id", meeting.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reunião atualizada");
    onSaved();
    setOpen(false);
  };

  const quickStatus = async (status: string) => {
    const { error } = await supabase.from("meeting").update({ status }).eq("id", meeting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado");
      onSaved();
    }
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
        <Select value={meeting.status} onValueChange={quickStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{STATUS[meeting.status] ?? meeting.status}</Badge>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Fechar edição" : "Editar dados da reunião"}
          </Button>
        </div>
        {open && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrida">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local / Link</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Pauta</Label>
              <Textarea rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MinuteEditor({ meetingId, minute, onSaved }: { meetingId: string; minute: any; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [formatted, setFormatted] = useState(minute?.formatted_content ?? "");
  const [raw, setRaw] = useState(minute?.raw_input ?? "");
  const [mode, setMode] = useState(minute?.generation_mode ?? "transcricao");
  const [status, setStatus] = useState(minute?.status ?? "rascunho");
  const [model, setModel] = useState(minute?.ai_model ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormatted(minute?.formatted_content ?? "");
    setRaw(minute?.raw_input ?? "");
    setMode(minute?.generation_mode ?? "transcricao");
    setStatus(minute?.status ?? "rascunho");
    setModel(minute?.ai_model ?? "");
  }, [minute?.id, minute?.updated_at]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        meeting_id: meetingId,
        formatted_content: formatted,
        raw_input: raw || null,
        generation_mode: mode,
        status,
        ai_model: model || null,
      };
      const { error } = await supabase.from("meeting_minute").upsert(payload, { onConflict: "meeting_id" });
      if (error) throw error;
      toast.success("Ata salva");
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar ata");
    } finally {
      setSaving(false);
    }
  };

  if (!minute && !editing) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">Nenhuma ata gerada ainda. Use a aba "Gerar ata com IA" ou crie manualmente.</p>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Plus className="mr-2 h-4 w-4" /> Criar ata manualmente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{status}</Badge>
            <Badge variant="outline">{mode}</Badge>
            {model && <span className="text-xs text-muted-foreground">{model}</span>}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
        </CardHeader>
        <CardContent>
          {formatted ? (
            <article className="prose prose-sm max-w-none whitespace-pre-wrap">{formatted}</article>
          ) : (
            <p className="text-sm text-muted-foreground">Ata vazia.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editar ata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="revisao">Em revisão</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="publicada">Publicada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modo de geração</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transcricao">Transcrição</SelectItem>
                <SelectItem value="anotacoes">Anotações</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="importacao">Importação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modelo IA</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="ex: gemini-2.5-flash" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Conteúdo da ata</Label>
          <Textarea value={formatted} onChange={(e) => setFormatted(e.target.value)} className="min-h-[300px] font-mono text-sm" />
        </div>

        <div className="space-y-2">
          <Label>Texto bruto / transcrição</Label>
          <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="min-h-[140px] text-sm" placeholder="Opcional" />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
