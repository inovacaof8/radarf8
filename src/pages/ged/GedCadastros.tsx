import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Users, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useGedAccess } from "@/hooks/useGedAccess";

type EntityKey = "ged_institution" | "ged_partner" | "ged_product";

type Row = {
  id: string;
  name: string;
  fantasy_name?: string | null;
  description?: string | null;
  contact_email?: string | null;
  document?: string | null;
  is_active: boolean;
};

const TABS: Record<EntityKey, { label: string; icon: any; queryKey: string; hasContact?: boolean; hasDocument?: boolean; hasFantasy?: boolean }> = {
  ged_institution: { label: "Instituições", icon: Building2, queryKey: "ged_institutions_crud", hasFantasy: true },
  ged_partner:     { label: "Parceiros",    icon: Users,     queryKey: "ged_partners_crud", hasContact: true, hasDocument: true, hasFantasy: true },
  ged_product:     { label: "Produtos",     icon: Package,   queryKey: "ged_products_crud" },
};

function CrudPanel({ table }: { table: EntityKey }) {
  const cfg = TABS[table];
  const qc = useQueryClient();
  const { canManage, canDelete } = useGedAccess();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState("");
  const [fantasyName, setFantasyName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

  const cols = ["id", "name", "is_active", "created_at"];
  if (table !== "ged_partner") cols.push("description");
  if (cfg.hasFantasy) cols.push("fantasy_name");
  if (cfg.hasContact) cols.push("contact_email");
  if (cfg.hasDocument) cols.push("document");

  const q = useQuery({
    queryKey: [cfg.queryKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select(cols.join(","))
        .order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  function openCreate() {
    setEditing(null);
    setName(""); setFantasyName(""); setDescription(""); setContactEmail(""); setDocNumber(""); setIsActive(true);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setName(r.name ?? "");
    setFantasyName(r.fantasy_name ?? "");
    setDescription(r.description ?? "");
    setContactEmail(r.contact_email ?? "");
    setDocNumber(r.document ?? "");
    setIsActive(r.is_active);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return toast.error("Razão Social é obrigatória.");
    setSaving(true);
    try {
      const payload: any = { name: name.trim(), is_active: isActive };
      if (table !== "ged_partner") payload.description = description || null;
      if (cfg.hasFantasy) payload.fantasy_name = fantasyName || null;
      if (cfg.hasContact) payload.contact_email = contactEmail || null;
      if (cfg.hasDocument) payload.document = docNumber || null;

      if (editing) {
        const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado.");
      } else {
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
        toast.success("Cadastrado.");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: [cfg.queryKey] });
      // also invalidate selectors used elsewhere
      qc.invalidateQueries({ queryKey: ["ged_partners"] });
      qc.invalidateQueries({ queryKey: ["ged_products"] });
      qc.invalidateQueries({ queryKey: ["ged_partners_all"] });
      qc.invalidateQueries({ queryKey: ["ged_products_all"] });
      qc.invalidateQueries({ queryKey: ["ged_institutions_all"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Row) {
    try {
      const { error } = await (supabase as any).from(table).delete().eq("id", r.id);
      if (error) throw error;
      toast.success("Excluído.");
      qc.invalidateQueries({ queryKey: [cfg.queryKey] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir. Verifique se há documentos vinculados.");
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <p className="text-sm text-muted-foreground">
            {(q.data?.length ?? 0)} {cfg.label.toLowerCase()} cadastrado(s)
          </p>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo
            </Button>
          )}
        </div>

        {q.isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : q.error ? (
          <EmptyState icon={AlertCircle} title="Erro ao carregar" description="Tente novamente." />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={cfg.icon}
            title={`Nenhum registro em ${cfg.label}`}
            description="Cadastre o primeiro registro."
            action={canManage ? <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                {cfg.hasFantasy && <TableHead>Nome Fantasia</TableHead>}
                {cfg.hasContact && <TableHead>E-mail de contato</TableHead>}
                {cfg.hasDocument && <TableHead>Documento</TableHead>}
                {table !== "ged_partner" && <TableHead>Descrição</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {cfg.hasFantasy && <TableCell>{r.fantasy_name ?? "—"}</TableCell>}
                  {cfg.hasContact && <TableCell>{r.contact_email ?? "—"}</TableCell>}
                  {cfg.hasDocument && <TableCell>{r.document ?? "—"}</TableCell>}
                  {table !== "ged_partner" && (
                    <TableCell className="max-w-md truncate">{r.description ?? "—"}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "secondary"}>
                      {r.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar" : "Novo"} — {cfg.label.replace(/s$/, "")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{cfg.hasFantasy ? "Razão Social *" : "Nome *"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {cfg.hasFantasy && (
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={fantasyName} onChange={(e) => setFantasyName(e.target.value)} />
              </div>
            )}
            {cfg.hasContact && (
              <div>
                <Label>E-mail de contato</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            )}
            {cfg.hasDocument && (
              <div>
                <Label>CNPJ / Documento</Label>
                <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              </div>
            )}
            {table !== "ged_partner" && (
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                className="h-4 w-4"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="active" className="!m-0">Ativo</Label>
            </div>
          </div>
          <SheetFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{confirmDelete?.name}</strong>? Documentos que referenciam este registro podem ser afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove(confirmDelete)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function GedCadastros() {
  const navigate = useNavigate();
  const { canView } = useGedAccess();
  const [tab, setTab] = useState<EntityKey>("ged_institution");

  if (!canView) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertCircle} title="Acesso negado" description="Você não possui permissão para acessar o GED." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Cadastros do GED"
        description="Gerencie instituições, parceiros e produtos utilizados nos documentos técnicos"
        actions={
          <Button variant="ghost" onClick={() => navigate("/ged")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao GED
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as EntityKey)}>
        <TabsList>
          <TabsTrigger value="ged_institution"><Building2 className="h-4 w-4 mr-2" />Instituições</TabsTrigger>
          <TabsTrigger value="ged_partner"><Users className="h-4 w-4 mr-2" />Parceiros</TabsTrigger>
          <TabsTrigger value="ged_product"><Package className="h-4 w-4 mr-2" />Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="ged_institution" className="mt-4"><CrudPanel table="ged_institution" /></TabsContent>
        <TabsContent value="ged_partner" className="mt-4"><CrudPanel table="ged_partner" /></TabsContent>
        <TabsContent value="ged_product" className="mt-4"><CrudPanel table="ged_product" /></TabsContent>
      </Tabs>
    </div>
  );
}
