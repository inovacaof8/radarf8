import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, DragEndEvent, PointerSensor, useDroppable, useDraggable,
  useSensor, useSensors,
} from "@dnd-kit/core";

type Bucket = "agora" | "proximo" | "depois" | "entregue";

const BUCKETS: { key: Bucket; label: string; tone: string }[] = [
  { key: "agora",    label: "Agora",    tone: "bg-brand-500 text-ink" },
  { key: "proximo",  label: "Próximo",  tone: "bg-primary/15 text-primary" },
  { key: "depois",   label: "Depois",   tone: "bg-secondary text-secondary-foreground" },
  { key: "entregue", label: "Entregue", tone: "bg-success/15 text-success" },
];

interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  swimlane: string | null;
  bucket: Bucket;
  start_date: string | null;
  end_date: string | null;
  ordering: number;
  portfolio_id: string | null;
  program_id: string | null;
  project_id: string | null;
}

export default function RoadmapPage() {
  const qc = useQueryClient();
  const [filterPortfolio, setFilterPortfolio] = useState<string>("all");
  const [editing, setEditing] = useState<RoadmapItem | null>(null);
  const [creating, setCreating] = useState(false);

  const portfolios = useQuery({
    queryKey: ["portfolios-opts"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name").order("name");
      return data || [];
    },
  });

  const items = useQuery({
    queryKey: ["roadmap-items", filterPortfolio],
    queryFn: async () => {
      let q = supabase.from("roadmap_item").select("*").order("ordering");
      if (filterPortfolio !== "all") q = q.eq("portfolio_id", filterPortfolio);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as RoadmapItem[];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, bucket }: { id: string; bucket: Bucket }) => {
      const { error } = await supabase.from("roadmap_item").update({ bucket }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, bucket }) => {
      await qc.cancelQueries({ queryKey: ["roadmap-items", filterPortfolio] });
      const prev = qc.getQueryData<RoadmapItem[]>(["roadmap-items", filterPortfolio]);
      qc.setQueryData<RoadmapItem[]>(["roadmap-items", filterPortfolio], (old) =>
        (old || []).map((i) => (i.id === id ? { ...i, bucket } : i))
      );
      return { prev };
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["roadmap-items", filterPortfolio], ctx.prev);
      toast.error(e.message || "Erro ao mover");
    },
    onSuccess: () => toast.success("Item movido"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["roadmap-items"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_item").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["roadmap-items"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    const item = items.data?.find((i) => i.id === id);
    if (!item || item.bucket === over) return;
    move.mutate({ id, bucket: over as Bucket });
  };

  const grouped = useMemo(() => {
    const g: Record<Bucket, RoadmapItem[]> = { agora: [], proximo: [], depois: [], entregue: [] };
    (items.data || []).forEach((i) => g[i.bucket].push(i));
    return g;
  }, [items.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roadmap"
        description="Visão estratégica: agora, próximo, depois e entregue."
        actions={
          <Button onClick={() => setCreating(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
            <Plus className="h-4 w-4 mr-1" /> Novo item
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <Label className="text-xs uppercase tracking-wider">Portfolio:</Label>
        <Select value={filterPortfolio} onValueChange={setFilterPortfolio}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(portfolios.data || []).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {BUCKETS.map((b) => <Skeleton key={b.key} className="h-64" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {BUCKETS.map((b) => (
              <BucketColumn
                key={b.key}
                bucket={b}
                items={grouped[b.key]}
                onEdit={setEditing}
                onRemove={(id) => remove.mutate(id)}
              />
            ))}
          </div>
        </DndContext>
      )}

      <ItemDialog
        open={creating || !!editing}
        item={editing}
        portfolios={portfolios.data || []}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["roadmap-items"] })}
      />
    </div>
  );
}

function BucketColumn({
  bucket, items, onEdit, onRemove,
}: {
  bucket: { key: Bucket; label: string; tone: string };
  items: RoadmapItem[];
  onEdit: (i: RoadmapItem) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.key });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-3 min-h-[300px] transition-colors ${
        isOver ? "border-brand-500 bg-brand-500/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge className={`uppercase font-bold ${bucket.tone}`}>{bucket.label}</Badge>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 italic">Vazio</p>
        )}
        {items.map((i) => (
          <RoadmapCard key={i.id} item={i} onEdit={onEdit} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function RoadmapCard({
  item, onEdit, onRemove,
}: {
  item: RoadmapItem;
  onEdit: (i: RoadmapItem) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
    >
      <CardContent className="p-3 space-y-2">
        <div {...listeners} {...attributes}>
          <p className="text-sm font-semibold leading-snug">{item.title}</p>
          {item.swimlane && (
            <Badge variant="outline" className="mt-1 text-[10px]">{item.swimlane}</Badge>
          )}
          {item.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
          )}
          {(item.start_date || item.end_date) && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {item.start_date ? new Date(item.start_date).toLocaleDateString("pt-BR") : "—"}
              {" → "}
              {item.end_date ? new Date(item.end_date).toLocaleDateString("pt-BR") : "—"}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-1 pt-1 border-t">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemDialog({
  open, item, portfolios, onClose, onSaved,
}: {
  open: boolean;
  item: RoadmapItem | null;
  portfolios: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [swimlane, setSwimlane] = useState(item?.swimlane || "");
  const [bucket, setBucket] = useState<Bucket>(item?.bucket || "proximo");
  const [startDate, setStartDate] = useState(item?.start_date || "");
  const [endDate, setEndDate] = useState(item?.end_date || "");
  const [portfolioId, setPortfolioId] = useState(item?.portfolio_id || "none");

  // reset on open
  useMemo(() => {
    if (open) {
      setTitle(item?.title || "");
      setDescription(item?.description || "");
      setSwimlane(item?.swimlane || "");
      setBucket(item?.bucket || "proximo");
      setStartDate(item?.start_date || "");
      setEndDate(item?.end_date || "");
      setPortfolioId(item?.portfolio_id || "none");
    }
  }, [open, item]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description: description || null,
        swimlane: swimlane || null,
        bucket,
        start_date: startDate || null,
        end_date: endDate || null,
        portfolio_id: portfolioId === "none" ? null : portfolioId,
      };
      if (item) {
        const { error } = await supabase.from("roadmap_item").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roadmap_item").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(item ? "Item atualizado" : "Item criado");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item de roadmap"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Bucket</Label>
              <Select value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUCKETS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Swimlane</Label>
              <Input value={swimlane} onChange={(e) => setSwimlane(e.target.value)} placeholder="ex: Plataforma" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Portfolio</Label>
            <Select value={portfolioId} onValueChange={setPortfolioId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            disabled={!title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
