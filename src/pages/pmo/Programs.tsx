import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/pmo/PageHeader";
import { StatusBadge } from "@/components/pmo/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type Program = {
  id: string;
  name: string;
  benefits: string | null;
  status: string;
  portfolio_id: string;
  start_date: string | null;
  end_date: string | null;
  portfolio?: { name: string } | null;
};

type PortfolioOpt = { id: string; name: string };

const STATUS_OPTIONS = [
  { v: "ativo", l: "Ativo" },
  { v: "pausado", l: "Pausado" },
  { v: "encerrado", l: "Encerrado" },
];

export default function ProgramsPage() {
  const { isAdmin, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Program | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Program | null>(null);
  const canManage = isAdmin
    || hasPermission("program", "create")
    || hasPermission("program", "edit")
    || hasPermission("program", "delete")
    || hasPermission("program", "admin");

  const list = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program")
        .select("id, name, benefits, status, portfolio_id, start_date, end_date, portfolio:portfolio_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Program[];
    },
  });

  const portfolios = useQuery({
    queryKey: ["portfolios-opts"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio").select("id, name").order("name");
      return (data || []) as PortfolioOpt[];
    },
  });

  const filtered = (list.data || []).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Program> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase.from("program").update({
          name: input.name, benefits: input.benefits, status: input.status,
          portfolio_id: input.portfolio_id, start_date: input.start_date, end_date: input.end_date,
        }).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("program").insert({
          name: input.name!, benefits: input.benefits ?? null, status: input.status ?? "ativo",
          portfolio_id: input.portfolio_id!, start_date: input.start_date ?? null, end_date: input.end_date ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Programa salvo");
      qc.invalidateQueries({ queryKey: ["programs"] });
      setEditing(null); setCreating(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Programa removido");
      qc.invalidateQueries({ queryKey: ["programs"] });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <div>
      <PageHeader
        title="Programas"
        description="Conjuntos de projetos com benefícios comuns dentro de um portfolio."
        actions={canManage && (
          <Button onClick={() => setCreating(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        )}
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Nenhum programa.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Portfolio</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.portfolio?.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString("pt-BR") : "—"}
                      {" → "}
                      {p.end_date ? new Date(p.end_date).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} kind="simple" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" title="Dashboard">
                          <Link to={`/programas/${p.id}/dashboard`}><BarChart3 className="h-4 w-4" /></Link>
                        </Button>
                        {canManage && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProgramSheet
        open={creating || !!editing}
        program={editing}
        portfolios={portfolios.data || []}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover programa?</AlertDialogTitle>
            <AlertDialogDescription>"{toDelete?.name}" será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProgramSheet({
  open, program, portfolios, onClose, onSave, saving,
}: {
  open: boolean;
  program: Program | null;
  portfolios: PortfolioOpt[];
  onClose: () => void;
  onSave: (p: Partial<Program> & { id?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [benefits, setBenefits] = useState("");
  const [status, setStatus] = useState("ativo");
  const [portfolioId, setPortfolioId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setBenefits(program?.benefits ?? "");
      setStatus(program?.status ?? "ativo");
      setPortfolioId(program?.portfolio_id ?? "");
      setStartDate(program?.start_date ?? "");
      setEndDate(program?.end_date ?? "");
    }
  }, [open, program]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{program ? "Editar programa" : "Novo programa"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Portfolio *</Label>
            <Select value={portfolioId} onValueChange={setPortfolioId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Benefícios esperados</Label>
            <Textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} />
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
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name.trim() || !portfolioId || saving}
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({
              id: program?.id,
              name: name.trim(),
              benefits: benefits.trim() || null,
              status,
              portfolio_id: portfolioId,
              start_date: startDate || null,
              end_date: endDate || null,
            })}
          >Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
