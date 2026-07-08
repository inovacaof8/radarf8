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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import PortfolioAreaPicker, { PortfolioAreaOption } from "@/components/pmo/PortfolioAreaPicker";

type Portfolio = {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  owner_id: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { v: "ativo", l: "Ativo" },
  { v: "pausado", l: "Pausado" },
  { v: "encerrado", l: "Encerrado" },
];

export default function PortfoliosPage() {
  const { user, isAdmin, hasPermission, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);

  const canManage = isAdmin
    || hasPermission("portfolio", "create")
    || hasPermission("portfolio", "edit")
    || hasPermission("portfolio", "delete")
    || hasPermission("portfolio", "admin");

  const list = useQuery({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio")
        .select("id, name, objective, status, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Portfolios] fetch error:", error);
        throw error;
      }
      return (data || []) as Portfolio[];
    },
    staleTime: 30_000,
  });

  const manageableAreas = useQuery({
    queryKey: ["portfolio-manageable-areas", user?.id, isAdmin, hasAnyRole("PMO")],
    enabled: !!user,
    queryFn: async () => {
      const { data: allAreas, error } = await supabase
        .from("area")
        .select("id, name, acronym")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      if (isAdmin || hasAnyRole("PMO")) return (allAreas || []) as PortfolioAreaOption[];

      const [{ data: managed }, { data: memberships }] = await Promise.all([
        supabase.rpc("user_managed_areas", { _user_id: user!.id }),
        supabase.from("user_area_membership").select("area_id").eq("user_id", user!.id).eq("status", "active"),
      ]);
      const allowed = new Set<string>();
      (managed || []).forEach((m: any) => allowed.add(m.area_id));
      if (hasAnyRole("Gestor")) (memberships || []).forEach((m: any) => allowed.add(m.area_id));
      return ((allAreas || []) as PortfolioAreaOption[]).filter((area) => allowed.has(area.id));
    },
  });

  const syncPortfolioAreas = async (portfolioId: string, areaIds: string[]) => {
    const { data: existing, error: readError } = await (supabase as any)
      .from("portfolio_area")
      .select("area_id")
      .eq("portfolio_id", portfolioId);
    if (readError) throw readError;

    const existingIds = new Set<string>((existing || []).map((row: any) => row.area_id));
    const nextIds = new Set(areaIds);
    const toRemove = Array.from(existingIds).filter((id) => !nextIds.has(id));
    const toAdd = areaIds.filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await (supabase as any)
        .from("portfolio_area")
        .delete()
        .eq("portfolio_id", portfolioId)
        .in("area_id", toRemove);
      if (error) throw error;
    }

    if (toAdd.length > 0) {
      const { error } = await (supabase as any).from("portfolio_area").insert(
        toAdd.map((areaId, index) => ({
          portfolio_id: portfolioId,
          area_id: areaId,
          is_primary: index === 0 && existingIds.size === 0,
        }))
      );
      if (error) throw error;
    }
  };

  const filtered = (list.data || []).filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Portfolio> & { id?: string; area_ids?: string[] }) => {
      if (input.id) {
        const { error } = await supabase.from("portfolio").update({
          name: input.name, objective: input.objective, status: input.status,
        }).eq("id", input.id);
        if (error) throw error;
        await syncPortfolioAreas(input.id, input.area_ids || []);
      } else {
        const { data, error } = await supabase.from("portfolio").insert({
          name: input.name!, objective: input.objective ?? null, status: input.status ?? "ativo", owner_id: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        await syncPortfolioAreas(data.id, input.area_ids || []);
      }
    },
    onSuccess: () => {
      toast.success("Portfolio salvo");
      qc.invalidateQueries({ queryKey: ["portfolios"], refetchType: "active" });
      setEditing(null); setCreating(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { count: programCount, error: progErr } = await supabase
        .from("program")
        .select("id", { count: "exact", head: true })
        .eq("portfolio_id", id);
      if (progErr) throw progErr;
      if ((programCount ?? 0) > 0) {
        throw new Error(`Não é possível remover: este portfolio possui ${programCount} programa(s) vinculado(s). Remova ou mova os programas primeiro.`);
      }
      const { error } = await supabase.from("portfolio").delete().eq("id", id);
      if (error) {
        if ((error as any).code === "23503") {
          throw new Error("Não é possível remover: existem registros vinculados a este portfolio.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Portfolio removido");
      qc.invalidateQueries({ queryKey: ["portfolios"], refetchType: "active" });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const open = creating || !!editing;

  return (
    <div>
      <PageHeader
        title="Portfolios"
        description="Agrupamento estratégico de programas e projetos."
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
            <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {list.data?.length ? "Nenhum portfolio com esses filtros." : "Nenhum portfolio cadastrado."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-md truncate">{p.objective || "—"}</TableCell>
                    <TableCell><StatusBadge status={p.status} kind="simple" /></TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PortfolioSheet
        open={open}
        portfolio={editing}
        areas={manageableAreas.data || []}
        areasLoading={manageableAreas.isLoading}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. "{toDelete?.name}" será removido permanentemente.
            </AlertDialogDescription>
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

function PortfolioSheet({
  open, portfolio, areas, areasLoading, onClose, onSave, saving,
}: {
  open: boolean;
  portfolio: Portfolio | null;
  areas: PortfolioAreaOption[];
  areasLoading: boolean;
  onClose: () => void;
  onSave: (p: Partial<Portfolio> & { id?: string; area_ids?: string[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [status, setStatus] = useState<string>("ativo");
  const [areaIds, setAreaIds] = useState<string[]>([]);

  const portfolioAreas = useQuery({
    queryKey: ["portfolio-areas", portfolio?.id],
    enabled: open && !!portfolio?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("portfolio_area")
        .select("area_id")
        .eq("portfolio_id", portfolio!.id);
      if (error) throw error;
      return (data || []).map((row: any) => row.area_id) as string[];
    },
  });

  useEffect(() => {
    if (open) {
      setName(portfolio?.name ?? "");
      setObjective(portfolio?.objective ?? "");
      setStatus(portfolio?.status ?? "ativo");
      setAreaIds([]);
    }
  }, [open, portfolio]);

  useEffect(() => {
    if (!open) return;
    if (portfolio?.id) setAreaIds(portfolioAreas.data || []);
  }, [open, portfolio?.id, portfolioAreas.data]);

  const handleClose = () => { onClose(); };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{portfolio ? "Editar portfolio" : "Novo portfolio"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Modernização Urbana" />
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={4} />
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
          <PortfolioAreaPicker
            areas={areas}
            value={areaIds}
            onChange={setAreaIds}
            loading={areasLoading || portfolioAreas.isLoading}
            disabled={saving}
          />
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button
            disabled={!name.trim() || saving || portfolioAreas.isLoading}
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            onClick={() => onSave({ id: portfolio?.id, name: name.trim(), objective: objective.trim() || null, status, area_ids: areaIds })}
          >Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
