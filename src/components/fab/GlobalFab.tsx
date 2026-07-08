import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ClipboardList, X, Type, Pen, ListTodo, CalendarPlus, Eraser, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TarefaDialog } from "@/components/tarefa/TarefaDialog";
import { toast } from "sonner";

type Mode = "texto" | "caneta" | "todo" | "tarefa";
const LS_KEY = "fab.lastMode";

export function GlobalFab() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "texto";
    return (localStorage.getItem(LS_KEY) as Mode) ?? "texto";
  });
  const [openTarefa, setOpenTarefa] = useState(false);
  const [tarefaTitle, setTarefaTitle] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, mode);
  }, [mode]);

  // hide on auth pages
  const hidePaths = ["/login", "/forgot-password", "/change-password", "/reset-password", "/privacy", "/terms", "/cookies", "/access-denied", "/error"];
  if (!isAuthenticated || hidePaths.some((p) => location.pathname.startsWith(p))) return null;

  function handleSavedAsTarefa(titulo: string) {
    setTarefaTitle(titulo);
    setOpen(false);
    setOpenTarefa(true);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex gap-1">
              <ModeBtn active={mode === "texto"} onClick={() => setMode("texto")} icon={<Type className="h-4 w-4" />} label="Texto" />
              <ModeBtn active={mode === "caneta"} onClick={() => setMode("caneta")} icon={<Pen className="h-4 w-4" />} label="Caneta" />
              <ModeBtn active={mode === "todo"} onClick={() => setMode("todo")} icon={<ListTodo className="h-4 w-4" />} label="To-do" />
              <ModeBtn active={mode === "tarefa"} onClick={() => setMode("tarefa")} icon={<CalendarPlus className="h-4 w-4" />} label="Tarefa" />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3">
            {mode === "texto" && <TextoMode onSavedAsTarefa={handleSavedAsTarefa} />}
            {mode === "caneta" && <CanetaMode onSavedAsTarefa={handleSavedAsTarefa} />}
            {mode === "todo" && <TodoMode onSavedAsTarefa={handleSavedAsTarefa} />}
            {mode === "tarefa" && <TarefaQuickMode onCreate={(t) => handleSavedAsTarefa(t)} />}
          </div>
        </div>
      )}

      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-2xl"
        onClick={() => setOpen((v) => !v)}
        aria-label="Capturar nota / tarefa"
      >
        {open ? <X className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
      </Button>

      <TarefaDialog
        open={openTarefa}
        onOpenChange={setOpenTarefa}
        defaultTitle={tarefaTitle}
        defaultOrigem="manual"
      />
    </>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {icon}
    </button>
  );
}

/* ---------- TEXTO ---------- */
function TextoMode({ onSavedAsTarefa }: { onSavedAsTarefa: (t: string) => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!text.trim() || !user) return;
      const { error } = await supabase.from("fab_drawings" as any).insert({
        user_id: user.id, tipo: "texto", conteudo: { text }, texto_extraido: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota salva", {
        description: (<Link to="/notas" className="underline font-medium text-primary">Ver notas</Link>),
      });
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      setText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Capture uma ideia rápida..." />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={!text.trim() || save.isPending}>
          <Save className="h-3.5 w-3.5 mr-1" /> Salvar
        </Button>
        <Button size="sm" variant="outline" disabled={!text.trim()} onClick={() => onSavedAsTarefa(text.split("\n")[0])}>
          <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Virar tarefa
        </Button>
      </div>
    </div>
  );
}

/* ---------- CANETA ---------- */
function CanetaMode({ onSavedAsTarefa }: { onSavedAsTarefa: (t: string) => void }) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const current = useRef<Array<{ x: number; y: number }>>([]);
  const qc = useQueryClient();

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    current.current = [pos(e)];
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pos(e);
    current.current.push(p);
    const ctx = canvasRef.current!.getContext("2d")!;
    const prev = current.current[current.current.length - 2];
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = (e.pressure || 0.5) * 3 + 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (current.current.length > 1) strokes.current.push(current.current);
    current.current = [];
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    strokes.current = [];
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user || strokes.current.length === 0) return;
      const dataUrl = canvasRef.current!.toDataURL("image/png");
      const { error } = await supabase.from("fab_drawings" as any).insert({
        user_id: user.id, tipo: "caneta",
        conteudo: { strokes: strokes.current, image: dataUrl },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desenho salvo", {
        description: (<Link to="/notas" className="underline font-medium text-primary">Ver notas</Link>),
      });
      clear();
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef} width={620} height={360}
        className="w-full aspect-[16/9] rounded-md border bg-background touch-none"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-3.5 w-3.5 mr-1" /> Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          <Eraser className="h-3.5 w-3.5 mr-1" /> Limpar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSavedAsTarefa("Anotação à caneta")}>
          Virar tarefa
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Compatível com Apple Pencil e stylus.</p>
    </div>
  );
}

/* ---------- TO-DO ---------- */
function TodoMode({ onSavedAsTarefa }: { onSavedAsTarefa: (t: string) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Array<{ text: string; done: boolean }>>([{ text: "", done: false }]);
  const qc = useQueryClient();

  function update(i: number, patch: Partial<{ text: string; done: boolean }>) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function add() { setItems((arr) => [...arr, { text: "", done: false }]); }
  function remove(i: number) { setItems((arr) => arr.filter((_, idx) => idx !== i)); }

  const save = useMutation({
    mutationFn: async () => {
      const clean = items.filter((i) => i.text.trim());
      if (!user || clean.length === 0) return;
      const { error } = await supabase.from("fab_drawings" as any).insert({
        user_id: user.id, tipo: "todo", conteudo: { items: clean },
        texto_extraido: clean.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join("\n"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lista salva", {
        description: (<Link to="/notas" className="underline font-medium text-primary">Ver notas</Link>),
      });
      qc.invalidateQueries({ queryKey: ["fab_drawings"] });
      setItems([{ text: "", done: false }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="space-y-1 max-h-60 overflow-auto">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={it.done} onChange={(e) => update(i, { done: e.target.checked })} />
            <Input value={it.text} onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Item..." className="h-8"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={add}>+ Item</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-3.5 w-3.5 mr-1" /> Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSavedAsTarefa(items[0]?.text || "Lista")}>
          Virar tarefa
        </Button>
      </div>
    </div>
  );
}

/* ---------- TAREFA RÁPIDA ---------- */
function TarefaQuickMode({ onCreate }: { onCreate: (titulo: string) => void }) {
  const [titulo, setTitulo] = useState("");
  return (
    <div className="space-y-2">
      <Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da tarefa..."
        onKeyDown={(e) => { if (e.key === "Enter" && titulo.trim()) onCreate(titulo.trim()); }} />
      <Button size="sm" className="w-full" disabled={!titulo.trim()} onClick={() => onCreate(titulo.trim())}>
        <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Abrir formulário completo
      </Button>
    </div>
  );
}
