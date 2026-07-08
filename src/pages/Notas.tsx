import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { TarefaDialog } from "@/components/tarefa/TarefaDialog";
import { toast } from "sonner";
import {
  Search,
  FolderPlus,
  Folder,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Type,
  Pen,
  ListTodo,
  MoreVertical,
  CheckSquare,
  Square,
  FolderOpen,
  CalendarPlus,
  Bell,
  BellRing,
  BellOff,
} from "lucide-react";

interface NotaConteudo {
  text?: string;
  items?: Array<{ text: string; done: boolean }>;
  strokes?: any[];
  image?: string;
  pasta?: string;
  reminder_at?: string; // ISO datetime
  reminder_notified?: boolean;
}
interface NotaRow {
  id: string;
  user_id: string;
  tipo: "texto" | "caneta" | "todo" | "tarefa";
  conteudo: NotaConteudo;
  texto_extraido: string | null;
  created_at: string;
  updated_at: string;
}

function fmtRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function Notas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("todos");

  // Edição
  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState<NotaRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteFolder, setNoteFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Visualização
  const [viewingNote, setViewingNote] = useState<NotaRow | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Criar pasta
  const [openCreateFolderDialog, setOpenCreateFolderDialog] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");

  // Renomear pasta
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  // Excluir pasta
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [deleteFolderMode, setDeleteFolderMode] = useState<"unassign" | "move" | "delete_notes">("unassign");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string>("");

  // Imagem expandida
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Tarefa
  const [openTarefaDialog, setOpenTarefaDialog] = useState(false);
  const [tarefaTitle, setTarefaTitle] = useState("");

  // Lembrete
  const [reminderNote, setReminderNote] = useState<NotaRow | null>(null);
  const [reminderValue, setReminderValue] = useState<string>("");

  // Pastas customizadas (localStorage, independentes das notas)
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const folderStorageKey = useMemo(() => `notas_pastas_v2_${user?.id || "anon"}`, [user?.id]);

  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(folderStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCustomFolders(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [user, folderStorageKey]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(folderStorageKey, JSON.stringify(customFolders));
  }, [customFolders, folderStorageKey, user]);

  const { data: notas, isLoading } = useQuery<NotaRow[]>({
    queryKey: ["fab_drawings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fab_drawings" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as NotaRow[]) || [];
    },
  });

  // Pastas combinam customFolders + qualquer pasta presente em notas (para não "perder" pastas legadas)
  const pastas = useMemo(() => {
    const set = new Set<string>(customFolders);
    notas?.forEach((n) => {
      const p = n.conteudo?.pasta;
      if (p && p.trim()) set.add(p.trim());
    });
    return Array.from(set).sort();
  }, [notas, customFolders]);

  const filteredNotes = useMemo(() => {
    if (!notas) return [];
    return notas.filter((n) => {
      if (selectedFolder && n.conteudo?.pasta !== selectedFolder) return false;
      if (selectedType !== "todos" && n.tipo !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const texto = n.texto_extraido?.toLowerCase() || "";
        const pasta = n.conteudo?.pasta?.toLowerCase() || "";
        return texto.includes(q) || pasta.includes(q);
      }
      return true;
    });
  }, [notas, selectedFolder, selectedType, searchQuery]);

  const groupedNotes = useMemo(() => {
    const groups: Record<string, NotaRow[]> = {};
    filteredNotes.forEach((n) => {
      const k = fmtRelativeDate(n.created_at);
      if (!groups[k]) groups[k] = [];
      groups[k].push(n);
    });
    return Object.entries(groups);
  }, [filteredNotes]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fab_drawings" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success("Nota excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTodoMutation = useMutation({
    mutationFn: async ({ noteId, itemIndex, done }: { noteId: string; itemIndex: number; done: boolean }) => {
      const note = notas?.find((n) => n.id === noteId);
      if (!note) return;
      const newItems = note.conteudo.items?.map((it, idx) => (idx === itemIndex ? { ...it, done } : it)) || [];
      const newConteudo = { ...note.conteudo, items: newItems };
      const texto_extraido = newItems.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join("\n");
      const { error } = await supabase
        .from("fab_drawings" as any)
        .update({ conteudo: newConteudo, texto_extraido })
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fab_drawings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, texto, pasta }: { id: string; texto: string; pasta: string | null }) => {
      const note = notas?.find((n) => n.id === id);
      if (!note) return;
      const newConteudo = { ...note.conteudo };
      if (note.tipo === "texto") newConteudo.text = texto;
      if (pasta) newConteudo.pasta = pasta;
      else delete (newConteudo as any).pasta;
      const updatedFields: any = { conteudo: newConteudo };
      if (note.tipo === "texto") updatedFields.texto_extraido = texto.replace(/<[^>]+>/g, "");
      const { error } = await supabase
        .from("fab_drawings" as any)
        .update(updatedFields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success("Nota atualizada");
      setIsEditing(false);
      setEditingNote(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ noteId, pasta }: { noteId: string; pasta: string | null }) => {
      const note = notas?.find((n) => n.id === noteId);
      if (!note) return;
      const newConteudo = { ...note.conteudo };
      if (pasta) newConteudo.pasta = pasta;
      else delete (newConteudo as any).pasta;
      const { error } = await supabase
        .from("fab_drawings" as any)
        .update({ conteudo: newConteudo })
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success("Nota movida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setReminderMutation = useMutation({
    mutationFn: async ({ noteId, reminderAt }: { noteId: string; reminderAt: string | null }) => {
      const note = notas?.find((n) => n.id === noteId);
      if (!note) return;
      const newConteudo: NotaConteudo = { ...note.conteudo };
      if (reminderAt) {
        newConteudo.reminder_at = reminderAt;
        newConteudo.reminder_notified = false;
      } else {
        delete newConteudo.reminder_at;
        delete newConteudo.reminder_notified;
      }
      const { error } = await supabase
        .from("fab_drawings" as any)
        .update({ conteudo: newConteudo })
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success(vars.reminderAt ? "Lembrete definido" : "Lembrete removido");
      setReminderNote(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Marca lembrete como já notificado (interno)
  async function markReminderNotified(noteId: string) {
    const note = notas?.find((n) => n.id === noteId);
    if (!note) return;
    const newConteudo: NotaConteudo = { ...note.conteudo, reminder_notified: true };
    await supabase.from("fab_drawings" as any).update({ conteudo: newConteudo }).eq("id", noteId);
    qc.invalidateQueries({ queryKey: ["fab_drawings"] });
  }

  // Solicita permissão de notificação ao montar
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Polling: verifica lembretes vencidos a cada 30s
  useEffect(() => {
    if (!notas) return;
    const check = () => {
      const now = Date.now();
      notas.forEach((n) => {
        const at = n.conteudo?.reminder_at;
        if (!at || n.conteudo?.reminder_notified) return;
        const t = new Date(at).getTime();
        if (isNaN(t) || t > now) return;
        const title = "Lembrete de nota";
        const body =
          n.texto_extraido?.slice(0, 120) ||
          n.conteudo?.text?.replace(/<[^>]+>/g, "").slice(0, 120) ||
          "Você tem um lembrete.";
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body, tag: `nota-${n.id}` });
          } catch {
            /* ignore */
          }
        }
        toast.info(title, { description: body, duration: 10000 });
        markReminderNotified(n.id);
      });
    };
    check();
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notas]);


  const renameFolderMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const affected = (notas || []).filter((n) => n.conteudo?.pasta === from);
      for (const note of affected) {
        const newConteudo = { ...note.conteudo, pasta: to };
        const { error } = await supabase
          .from("fab_drawings" as any)
          .update({ conteudo: newConteudo })
          .eq("id", note.id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      setCustomFolders((prev) => Array.from(new Set(prev.map((p) => (p === vars.from ? vars.to : p)))).sort());
      if (selectedFolder === vars.from) setSelectedFolder(vars.to);
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success("Pasta renomeada");
      setRenamingFolder(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async ({
      folder,
      mode,
      target,
    }: {
      folder: string;
      mode: "unassign" | "move" | "delete_notes";
      target?: string;
    }) => {
      const affected = (notas || []).filter((n) => n.conteudo?.pasta === folder);
      if (mode === "delete_notes") {
        for (const note of affected) {
          const { error } = await supabase
            .from("fab_drawings" as any)
            .delete()
            .eq("id", note.id);
          if (error) throw error;
        }
      } else {
        for (const note of affected) {
          const newConteudo = { ...note.conteudo };
          if (mode === "move" && target) newConteudo.pasta = target;
          else delete (newConteudo as any).pasta;
          const { error } = await supabase
            .from("fab_drawings" as any)
            .update({ conteudo: newConteudo })
            .eq("id", note.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_d, vars) => {
      setCustomFolders((prev) => prev.filter((p) => p !== vars.folder));
      if (selectedFolder === vars.folder) setSelectedFolder(null);
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      toast.success("Pasta excluída");
      setDeletingFolder(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEditModal(note: NotaRow) {
    setEditingNote(note);
    setNoteText(note.conteudo?.text || note.texto_extraido || "");
    setNoteFolder(note.conteudo?.pasta || "");
    setShowNewFolderInput(false);
    setNewFolderName("");
    setIsEditing(true);
  }

  function handleSaveEdit() {
    if (!editingNote) return;
    const finalFolder = showNewFolderInput ? newFolderName.trim() : noteFolder;
    if (showNewFolderInput && finalFolder && !pastas.includes(finalFolder)) {
      setCustomFolders((prev) => [...prev, finalFolder].sort());
    }
    editMutation.mutate({
      id: editingNote.id,
      texto: noteText,
      pasta: !finalFolder || finalFolder === "none" ? null : finalFolder,
    });
  }

  function handleCreateFolder() {
    const name = createFolderName.trim();
    if (!name) {
      toast.error("Digite um nome");
      return;
    }
    if (pastas.includes(name)) {
      toast.error("Já existe pasta com esse nome");
      return;
    }
    setCustomFolders((prev) => [...prev, name].sort());
    setCreateFolderName("");
    setOpenCreateFolderDialog(false);
    toast.success(`Pasta "${name}" criada`);
  }

  function handleRenameFolder() {
    if (!renamingFolder) return;
    const name = renameFolderName.trim();
    if (!name) return toast.error("Digite um nome");
    if (name === renamingFolder) {
      setRenamingFolder(null);
      return;
    }
    if (pastas.includes(name)) return toast.error("Já existe pasta com esse nome");
    renameFolderMutation.mutate({ from: renamingFolder, to: name });
  }

  function handleConfirmDeleteFolder() {
    if (!deletingFolder) return;
    if (deleteFolderMode === "move" && !deleteFolderTarget) return toast.error("Selecione a pasta de destino");
    deleteFolderMutation.mutate({
      folder: deletingFolder,
      mode: deleteFolderMode,
      target: deleteFolderMode === "move" ? deleteFolderTarget : undefined,
    });
  }

  function handleVirarTarefa(text: string) {
    setTarefaTitle(text);
    setOpenTarefaDialog(true);
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-10rem)]">
      {/* Painel Lateral */}
      <div className="w-full md:w-64 shrink-0 space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" /> Pastas
          </h2>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setSelectedFolder(null)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition ${
              selectedFolder === null
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Folder className="h-4 w-4" />
            <span>Todas as Notas</span>
          </button>
          {pastas.map((pasta) => (
            <div
              key={pasta}
              className={`group/folder flex items-center gap-1 rounded-lg transition ${
                selectedFolder === pasta ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <button
                onClick={() => setSelectedFolder(pasta)}
                className={`flex items-center gap-2 px-3 py-2 text-sm text-left flex-1 min-w-0 ${selectedFolder === pasta ? "font-semibold" : ""}`}
              >
                <Folder className="h-4 w-4 text-primary" />
                <span className="truncate flex-1">{pasta}</span>
              </button>
              <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFolder(pasta);
                    setRenameFolderName(pasta);
                  }}
                  className="p-1 rounded hover:bg-background/60"
                  title="Renomear pasta"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingFolder(pasta);
                    setDeleteFolderMode("unassign");
                    setDeleteFolderTarget("");
                  }}
                  className="p-1 rounded hover:bg-background/60 text-destructive"
                  title="Excluir pasta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {pastas.length === 0 && (
            <span className="text-xs text-muted-foreground px-3 py-2 italic">Nenhuma pasta criada</span>
          )}
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => {
            setCreateFolderName("");
            setOpenCreateFolderDialog(true);
          }}
        >
          <FolderPlus className="h-4 w-4" /> Criar Pasta
        </Button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Notas Rápidas</h1>
            <p className="text-sm text-muted-foreground">
              Anotações, desenhos e listas capturados pelo botão flutuante.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar notas por texto ou pasta..."
              className="pl-9 bg-card"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex border rounded-lg p-1 bg-muted/30 shrink-0 w-full sm:w-auto">
            {[
              { v: "todos", l: "Todas" },
              { v: "texto", l: "Texto" },
              { v: "todo", l: "Listas" },
              { v: "caneta", l: "Desenhos" },
            ].map((t) => (
              <button
                key={t.v}
                onClick={() => setSelectedType(t.v)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  selectedType === t.v
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : groupedNotes.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="Nenhuma nota encontrada"
            description="Use o botão (+) no canto inferior direito para fazer anotações rápidas de onde estiver."
          />
        ) : (
          <div className="space-y-8">
            {groupedNotes.map(([date, notesInGroup]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-extrabold text-sm text-muted-foreground uppercase tracking-wider">{date}</h3>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {notesInGroup.map((note) => (
                    <Card
                      key={note.id}
                      className="flex flex-col border bg-card/65 shadow-sm hover:shadow-md transition relative group overflow-hidden cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest("button") ||
                          target.closest(".prevent-view") ||
                          target.closest("[role='menuitem']")
                        )
                          return;
                        setViewingNote(note);
                      }}
                    >
                      <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {note.tipo === "texto" && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Type className="h-3 w-3 text-sky-500" /> Texto
                                </Badge>
                              )}
                              {note.tipo === "todo" && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <ListTodo className="h-3 w-3 text-emerald-500" /> Lista
                                </Badge>
                              )}
                              {note.tipo === "caneta" && (
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <Pen className="h-3 w-3 text-amber-500" /> Desenho
                                </Badge>
                              )}
                              {note.conteudo?.pasta && (
                                <Badge
                                  variant="secondary"
                                  className="bg-primary/10 text-primary border-transparent text-[10px] max-w-[100px] truncate"
                                >
                                  {note.conteudo.pasta}
                                </Badge>
                              )}
                              {note.conteudo?.reminder_at && (
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-[10px] border-primary/40 text-primary"
                                  title={`Lembrete: ${new Date(note.conteudo.reminder_at).toLocaleString("pt-BR")}`}
                                >
                                  <BellRing className="h-3 w-3" />
                                  {new Date(note.conteudo.reminder_at).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {formatTime(note.created_at)}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openEditModal(note)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
                                      <Folder className="h-3.5 w-3.5" /> Mover para pasta
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {pastas.length === 0 && (
                                        <DropdownMenuItem disabled>Nenhuma pasta</DropdownMenuItem>
                                      )}
                                      {pastas.map((p) => (
                                        <DropdownMenuItem
                                          key={p}
                                          className="cursor-pointer"
                                          onClick={() => moveToFolderMutation.mutate({ noteId: note.id, pasta: p })}
                                        >
                                          {note.conteudo?.pasta === p ? <span className="font-semibold">{p}</span> : p}
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuItem
                                        className="cursor-pointer text-muted-foreground"
                                        onClick={() => moveToFolderMutation.mutate({ noteId: note.id, pasta: null })}
                                      >
                                        Remover da pasta
                                      </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuItem
                                    disabled //botão desativado por enquanto
                                    onClick={() =>
                                      handleVirarTarefa(
                                        note.texto_extraido?.split("\n")[0] ||
                                          note.conteudo?.text?.replace(/<[^>]+>/g, "").split("\n")[0] ||
                                          "Tarefa",
                                      )
                                    }
                                    className="gap-2 cursor-pointer"
                                  >
                                    <CalendarPlus className="h-3.5 w-3.5" /> Virar Tarefa
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setReminderNote(note);
                                      // Pré-preenche com valor existente, senão agora+1h
                                      const existing = note.conteudo?.reminder_at;
                                      const d = existing ? new Date(existing) : new Date(Date.now() + 60 * 60 * 1000);
                                      const pad = (n: number) => String(n).padStart(2, "0");
                                      const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                      setReminderValue(local);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    {note.conteudo?.reminder_at ? (
                                      <BellRing className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <Bell className="h-3.5 w-3.5" />
                                    )}
                                    {note.conteudo?.reminder_at ? "Editar lembrete" : "Definir lembrete"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setNoteToDelete(note.id)}
                                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="text-sm text-foreground/95 break-words line-clamp-6">
                            {note.tipo === "texto" && (
                              <div
                                className="whitespace-pre-wrap leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: note.conteudo?.text || note.texto_extraido || "" }}
                              />
                            )}

                            {note.tipo === "todo" && (
                              <div className="space-y-1.5">
                                {note.conteudo?.items?.map((it, idx) => (
                                  <div
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTodoMutation.mutate({ noteId: note.id, itemIndex: idx, done: !it.done });
                                    }}
                                    className="flex items-start gap-2 hover:bg-muted/40 p-0.5 rounded cursor-pointer transition select-none prevent-view"
                                  >
                                    {it.done ? (
                                      <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                      <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    )}
                                    <span
                                      className={`leading-tight text-xs ${it.done ? "line-through text-muted-foreground" : "text-foreground"}`}
                                    >
                                      {it.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {note.tipo === "caneta" && note.conteudo?.image && (
                              <div
                                className="relative aspect-[16/9] border rounded-lg overflow-hidden bg-white cursor-pointer group/img"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImage(note.conteudo.image || null);
                                }}
                              >
                                <img src={note.conteudo.image} alt="Desenho" className="w-full h-full object-contain" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                                  <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded-full">
                                    Expandir desenho
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Excluir nota */}
      <AlertDialog open={!!noteToDelete} onOpenChange={(v) => !v && setNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nota</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação é definitiva.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) {
                  deleteMutation.mutate(noteToDelete);
                  setNoteToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renomear pasta */}
      <Dialog open={!!renamingFolder} onOpenChange={(v) => !v && setRenamingFolder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear Pasta</DialogTitle>
            <DialogDescription>Insira o novo nome da pasta.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameFolderName}
            onChange={(e) => setRenameFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameFolder();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingFolder(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRenameFolder} disabled={renameFolderMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir pasta */}
      <Dialog open={!!deletingFolder} onOpenChange={(v) => !v && setDeletingFolder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Pasta "{deletingFolder}"</DialogTitle>
            <DialogDescription>O que fazer com as notas dentro desta pasta?</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={deleteFolderMode}
            onValueChange={(v: any) => setDeleteFolderMode(v)}
            className="space-y-2 py-2"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="unassign" id="m-unassign" />
              <span className="text-sm">Manter notas (apenas remover da pasta)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="move" id="m-move" />
              <span className="text-sm">Mover notas para outra pasta</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="delete_notes" id="m-del" />
              <span className="text-sm text-destructive">Excluir todas as notas desta pasta</span>
            </label>
          </RadioGroup>
          {deleteFolderMode === "move" && (
            <Select value={deleteFolderTarget} onValueChange={setDeleteFolderTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a pasta de destino" />
              </SelectTrigger>
              <SelectContent>
                {pastas
                  .filter((p) => p !== deletingFolder)
                  .map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFolder(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDeleteFolder}
              disabled={deleteFolderMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizar / Editar rápido */}
      <Dialog open={!!viewingNote} onOpenChange={(v) => !v && setViewingNote(null)}>
        <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 pb-2 border-b bg-muted/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                {viewingNote?.tipo === "texto" && <Type className="h-5 w-5 text-sky-500" />}
                {viewingNote?.tipo === "todo" && <ListTodo className="h-5 w-5 text-emerald-500" />}
                {viewingNote?.tipo === "caneta" && <Pen className="h-5 w-5 text-amber-500" />}
                Detalhes da Nota
              </DialogTitle>
              <DialogDescription>
                {viewingNote && fmtRelativeDate(viewingNote.created_at)} às{" "}
                {viewingNote && formatTime(viewingNote.created_at)}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
            {viewingNote?.tipo === "texto" && (
              <div className="border rounded-xl overflow-hidden flex flex-col bg-card shadow-sm h-full min-h-[300px]">
                <div className="flex items-center gap-1 p-2 border-b bg-muted/40 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 font-bold font-serif"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("bold", false, undefined)}
                    title="Negrito"
                  >
                    B
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 font-serif italic"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("italic", false, undefined)}
                    title="Itálico"
                  >
                    I
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 underline"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => document.execCommand("underline", false, undefined)}
                    title="Sublinhado"
                  >
                    U
                  </Button>
                  <div className="w-px h-5 bg-border mx-2" />
                  {[
                    { label: "Padrão", value: "inherit" },
                    { label: "Azul", value: "#3b82f6" },
                    { label: "Verde", value: "#10b981" },
                    { label: "Amarelo", value: "#eab308" },
                    { label: "Vermelho", value: "#ef4444" },
                    { label: "Rosa", value: "#ec4899" },
                  ].map((c) => (
                    <button
                      key={c.value}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => document.execCommand("foreColor", false, c.value === "inherit" ? "" : c.value)}
                      className="h-6 w-6 rounded-full border border-border shadow-sm transition hover:scale-110 flex items-center justify-center bg-card"
                      style={{ backgroundColor: c.value === "inherit" ? undefined : c.value }}
                      title={c.label}
                    >
                      {c.value === "inherit" && <Type className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  ))}
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="flex-1 p-5 outline-none whitespace-pre-wrap text-base focus:bg-white transition-colors"
                  dangerouslySetInnerHTML={{ __html: viewingNote?.conteudo?.text || viewingNote?.texto_extraido || "" }}
                />
              </div>
            )}

            {viewingNote?.tipo === "todo" && (
              <div className="space-y-2">
                {viewingNote?.conteudo?.items?.map((it, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!viewingNote) return;
                      toggleTodoMutation.mutate({ noteId: viewingNote.id, itemIndex: idx, done: !it.done });
                    }}
                    className="flex items-start gap-3 p-3 bg-card hover:bg-muted rounded-xl cursor-pointer transition select-none border shadow-sm"
                  >
                    {it.done ? (
                      <CheckSquare className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-base ${it.done ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}
                    >
                      {it.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {viewingNote?.tipo === "caneta" && viewingNote?.conteudo?.image && (
              <div className="flex justify-center bg-card border rounded-xl p-4 shadow-sm">
                <img src={viewingNote.conteudo.image} alt="Desenho" className="max-w-full rounded-lg" />
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-card flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setViewingNote(null)}>
              {viewingNote?.tipo === "texto" ? "Cancelar" : "Fechar"}
            </Button>
            {viewingNote?.tipo === "texto" && (
              <Button
                onClick={() => {
                  if (!viewingNote) return;
                  const finalHtml = editorRef.current?.innerHTML || "";
                  editMutation.mutate({
                    id: viewingNote.id,
                    texto: finalHtml,
                    pasta: viewingNote.conteudo?.pasta || null,
                  });
                  setViewingNote(null);
                }}
                disabled={editMutation.isPending}
              >
                Salvar Alterações
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Imagem expandida */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-white">
          <DialogHeader className="hidden">
            <DialogTitle>Desenho Expandido</DialogTitle>
          </DialogHeader>
          {expandedImage && (
            <div className="relative w-full h-[80vh] flex items-center justify-center bg-zinc-950 rounded-lg overflow-hidden">
              <img src={expandedImage} alt="Desenho" className="max-w-full max-h-full object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar Nota */}
      <Dialog
        open={isEditing}
        onOpenChange={(v) => {
          if (!v) {
            setIsEditing(false);
            setEditingNote(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Nota</DialogTitle>
            <DialogDescription>Modifique o conteúdo ou organize em pastas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {editingNote?.tipo === "texto" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Conteúdo</label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={5}
                  placeholder="Editar anotação..."
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Folder className="h-3.5 w-3.5" /> Pasta
                </label>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="h-auto p-0 text-xs font-semibold text-primary"
                >
                  {showNewFolderInput ? "Usar pasta existente" : "+ Nova Pasta"}
                </Button>
              </div>

              {showNewFolderInput ? (
                <Input
                  placeholder="Nome da nova pasta..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                />
              ) : (
                <Select value={noteFolder || "none"} onValueChange={(val) => setNoteFolder(val === "none" ? "" : val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma Pasta (Geral)</SelectItem>
                    {pastas.map((pasta) => (
                      <SelectItem key={pasta} value={pasta}>
                        {pasta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tarefa */}
      <TarefaDialog
        open={openTarefaDialog}
        onOpenChange={setOpenTarefaDialog}
        defaultTitle={tarefaTitle}
        defaultOrigem="manual"
      />

      {/* Lembrete */}
      <Dialog open={!!reminderNote} onOpenChange={(v) => !v && setReminderNote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" /> Lembrete da Nota
            </DialogTitle>
            <DialogDescription>
              Escolha a data e o horário. Você receberá uma notificação do navegador (mantenha o sistema aberto em
              alguma aba).
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase">Quando avisar</label>
            <Input
              type="datetime-local"
              value={reminderValue}
              onChange={(e) => setReminderValue(e.target.value)}
            />
            {typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "denied" && (
                <p className="text-xs text-destructive">
                  As notificações do navegador estão bloqueadas. Habilite-as nas configurações do navegador para
                  receber o alerta sonoro/visual.
                </p>
              )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            {reminderNote?.conteudo?.reminder_at && (
              <Button
                variant="outline"
                onClick={() =>
                  reminderNote &&
                  setReminderMutation.mutate({ noteId: reminderNote.id, reminderAt: null })
                }
                disabled={setReminderMutation.isPending}
                className="gap-2"
              >
                <BellOff className="h-4 w-4" /> Remover
              </Button>
            )}
            <Button variant="ghost" onClick={() => setReminderNote(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!reminderNote || !reminderValue) {
                  toast.error("Selecione a data e o horário");
                  return;
                }
                const iso = new Date(reminderValue).toISOString();
                if (new Date(iso).getTime() < Date.now()) {
                  toast.error("Escolha uma data futura");
                  return;
                }
                if ("Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission().catch(() => {});
                }
                setReminderMutation.mutate({ noteId: reminderNote.id, reminderAt: iso });
              }}
              disabled={setReminderMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar pasta */}
      <Dialog open={openCreateFolderDialog} onOpenChange={setOpenCreateFolderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
            <DialogDescription>Insira o nome da nova pasta para organizar suas notas.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome da pasta..."
              value={createFolderName}
              onChange={(e) => setCreateFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateFolderDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
