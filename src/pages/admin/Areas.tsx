import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Plus, Edit, Trash2, ShieldOff, ShieldCheck, UserCog, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Area = {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  parent_area_id: string | null;
  status: "active" | "inactive";
  sort_order: number;
};

type Manager = {
  id: string;
  area_id: string;
  user_id: string;
  manager_type: "principal" | "substitute" | "support";
  include_child_areas: boolean;
  start_date: string;
  end_date: string | null;
  status: "active" | "inactive";
};

const MANAGER_TYPE_LABEL: Record<string, string> = {
  principal: "Principal",
  substitute: "Substituto",
  support: "Apoio",
};

export default function AreasPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [areaDialog, setAreaDialog] = useState<{ open: boolean; editing: Area | null; defaultParentId?: string | null }>({ open: false, editing: null });
  const [managerDialog, setManagerDialog] = useState<{ open: boolean; editing: Manager | null }>({ open: false, editing: null });

  const { data: areas, isLoading } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("area").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data || []) as Area[];
    },
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: profiles } = useQuery({
    queryKey: ["areas-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, email, status").eq("status", "active").order("name");
      return data || [];
    },
  });

  const { data: managers } = useQuery({
    enabled: !!selectedId,
    queryKey: ["area-managers", selectedId],
    queryFn: async () => {
      const { data } = await supabase.from("area_manager").select("*").eq("area_id", selectedId!).order("created_at");
      return (data || []) as Manager[];
    },
  });

  const { data: members } = useQuery({
    enabled: !!selectedId,
    queryKey: ["area-members", selectedId],
    queryFn: async () => {
      const { data } = await supabase.from("user_area_membership").select("*").eq("area_id", selectedId!).eq("status", "active");
      return data || [];
    },
  });

  const tree = useMemo(() => {
    if (!areas) return [];
    const byParent = new Map<string | null, Area[]>();
    for (const a of areas) {
      const k = a.parent_area_id;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(a);
    }
    const build = (parent: string | null, depth: number): { area: Area; depth: number }[] => {
      const list = byParent.get(parent) || [];
      return list.flatMap((a) => [{ area: a, depth }, ...build(a.id, depth + 1)]);
    };
    return build(null, 0);
  }, [areas]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const s = search.toLowerCase();
    return tree.filter(({ area }) =>
      area.name.toLowerCase().includes(s) || (area.acronym || "").toLowerCase().includes(s)
    );
  }, [tree, search]);

  const selected = areas?.find((a) => a.id === selectedId) || null;
  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    (profiles || []).forEach((p: any) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  if (!isAdmin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Acesso restrito a administradores.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Áreas</h1>
          <p className="text-muted-foreground">Estrutura organizacional, gestores e vínculos</p>
        </div>
        <Button onClick={() => setAreaDialog({ open: true, editing: null })} className="gap-2">
          <Plus className="h-4 w-4" /> Nova área
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* Árvore */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input placeholder="Buscar área..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="border rounded-md max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Área</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTree.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhuma área cadastrada.
                    </TableCell></TableRow>
                  ) : filteredTree.map(({ area, depth }) => (
                    <TableRow
                      key={area.id}
                      onClick={() => setSelectedId(area.id)}
                      className={`cursor-pointer ${selectedId === area.id ? "bg-muted" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
                          {depth > 0 && (
                            <span className="text-muted-foreground/60 font-mono text-xs select-none mr-1">
                              {"└─"}
                            </span>
                          )}
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{area.name}</span>
                          {area.acronym && <Badge variant="outline" className="text-[10px]">{area.acronym}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={area.status === "active" ? "default" : "secondary"}>
                          {area.status === "active" ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost" size="sm" title="Criar subárea"
                            onClick={(e) => { e.stopPropagation(); setAreaDialog({ open: true, editing: null, defaultParentId: area.id }); }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm" title="Editar"
                            onClick={(e) => { e.stopPropagation(); setAreaDialog({ open: true, editing: area }); }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detalhe */}
        <Card>
          <CardContent className="pt-6">
            {!selected ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mb-3 opacity-50" />
                <p>Selecione uma área para ver gestores e pessoas vinculadas.</p>
              </div>
            ) : (
              <Tabs defaultValue="info">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    <p className="text-xs text-muted-foreground">{selected.acronym || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAreaDialog({ open: true, editing: selected })} className="gap-1">
                      <Edit className="h-3.5 w-3.5" /> Editar
                    </Button>
                    {selected.status === "active" ? (
                      <Button variant="outline" size="sm" onClick={async () => {
                        await supabase.from("area").update({ status: "inactive" }).eq("id", selected.id);
                        toast.success("Área inativada.");
                        qc.invalidateQueries({ queryKey: ["areas-all"] });
                      }} className="gap-1"><ShieldOff className="h-3.5 w-3.5" /> Inativar</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={async () => {
                        await supabase.from("area").update({ status: "active" }).eq("id", selected.id);
                        toast.success("Área ativada.");
                        qc.invalidateQueries({ queryKey: ["areas-all"] });
                      }} className="gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Ativar</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={async () => {
                      if (!confirm(`Remover a área "${selected.name}"? Será bloqueado se houver vínculos.`)) return;
                      const { error } = await supabase.from("area").delete().eq("id", selected.id);
                      if (error) { toast.error(error.message); return; }
                      toast.success("Área removida.");
                      setSelectedId(null);
                      qc.invalidateQueries({ queryKey: ["areas-all"] });
                    }} className="gap-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <TabsList>
                  <TabsTrigger value="info">Informações</TabsTrigger>
                  <TabsTrigger value="managers">Gestores ({managers?.length || 0})</TabsTrigger>
                  <TabsTrigger value="members">Pessoas ({members?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="pt-3 space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Descrição: </span>{selected.description || "—"}</div>
                  <div><span className="text-muted-foreground">Área superior: </span>{areas?.find((x) => x.id === selected.parent_area_id)?.name || "—"}</div>
                  <div><span className="text-muted-foreground">Ordem: </span>{selected.sort_order}</div>
                </TabsContent>

                <TabsContent value="managers" className="pt-3">
                  <div className="flex justify-end mb-2">
                    <Button size="sm" onClick={() => setManagerDialog({ open: true, editing: null })} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> Adicionar gestor
                    </Button>
                  </div>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Gestor</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Abrangência</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(managers || []).length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum gestor vinculado.</TableCell></TableRow>
                        ) : managers!.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{profileMap.get(m.user_id)?.name || "—"}</TableCell>
                            <TableCell>{MANAGER_TYPE_LABEL[m.manager_type]}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{m.include_child_areas ? "Inclui subordinadas" : "Apenas a área"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(m.start_date).toLocaleDateString("pt-BR")}
                              {m.end_date ? ` → ${new Date(m.end_date).toLocaleDateString("pt-BR")}` : ""}
                            </TableCell>
                            <TableCell>
                              <Badge variant={m.status === "active" ? "default" : "secondary"}>
                                {m.status === "active" ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setManagerDialog({ open: true, editing: m })}><Edit className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" onClick={async () => {
                                  if (!confirm("Remover este gestor?")) return;
                                  await supabase.from("area_manager").delete().eq("id", m.id);
                                  toast.success("Gestor removido.");
                                  qc.invalidateQueries({ queryKey: ["area-managers", selectedId] });
                                }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="members" className="pt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Pessoas com vínculo (principal ou adicional) nesta área. Edite o vínculo principal pelo cadastro do usuário.
                  </p>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Tipo de vínculo</TableHead>
                          <TableHead>Início</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(members || []).length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma pessoa vinculada.</TableCell></TableRow>
                        ) : members!.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{profileMap.get(m.user_id)?.name || "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{profileMap.get(m.user_id)?.email || "—"}</TableCell>
                            <TableCell><Badge variant="outline">{m.membership_type === "primary" ? "Principal" : "Adicional"}</Badge></TableCell>
                            <TableCell className="text-xs">{new Date(m.start_date).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <AreaDialog
        open={areaDialog.open}
        editing={areaDialog.editing}
        defaultParentId={areaDialog.defaultParentId ?? null}
        areas={areas || []}
        onClose={() => setAreaDialog({ open: false, editing: null })}
        onSaved={() => qc.invalidateQueries({ queryKey: ["areas-all"] })}
        creatorId={user!.id}
      />

      <ManagerDialog
        open={managerDialog.open}
        editing={managerDialog.editing}
        areaId={selectedId}
        profiles={profiles || []}
        onClose={() => setManagerDialog({ open: false, editing: null })}
        onSaved={() => qc.invalidateQueries({ queryKey: ["area-managers", selectedId] })}
        creatorId={user!.id}
      />
    </div>
  );
}

function AreaDialog({ open, editing, defaultParentId, areas, onClose, onSaved, creatorId }: {
  open: boolean; editing: Area | null; defaultParentId?: string | null; areas: Area[];
  onClose: () => void; onSaved: () => void; creatorId: string;
}) {
  const [form, setForm] = useState({ name: "", acronym: "", description: "", parent_area_id: "none", sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useMemo(() => {
    if (open) {
      setErr("");
      setForm({
        name: editing?.name || "",
        acronym: editing?.acronym || "",
        description: editing?.description || "",
        parent_area_id: editing?.parent_area_id || defaultParentId || "none",
        sort_order: editing?.sort_order ?? 0,
      });
    }
  }, [open, editing, defaultParentId]);

  const parentOptions = areas.filter((a) => a.id !== editing?.id);

  const save = async () => {
    setErr("");
    if (!form.name.trim()) { setErr("Nome é obrigatório."); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      acronym: form.acronym.trim() || null,
      description: form.description.trim() || null,
      parent_area_id: form.parent_area_id === "none" ? null : form.parent_area_id,
      sort_order: Number(form.sort_order) || 0,
      updated_by: creatorId,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("area").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("area").insert({ ...payload, created_by: creatorId }));
    }
    setSaving(false);
    if (error) { setErr(error.message); return; }
    toast.success(editing ? "Área atualizada." : "Área criada.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar área" : "Nova área"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {err && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Sigla</Label><Input value={form.acronym} onChange={(e) => setForm({ ...form, acronym: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Área superior</Label>
              <Select value={form.parent_area_id} onValueChange={(v) => setForm({ ...form, parent_area_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma (área raiz) —</SelectItem>
                  {parentOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagerDialog({ open, editing, areaId, profiles, onClose, onSaved, creatorId }: {
  open: boolean; editing: Manager | null; areaId: string | null; profiles: any[];
  onClose: () => void; onSaved: () => void; creatorId: string;
}) {
  const [form, setForm] = useState({
    user_id: "", manager_type: "principal" as Manager["manager_type"],
    include_child_areas: true,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useMemo(() => {
    if (open) {
      setErr("");
      setForm({
        user_id: editing?.user_id || "",
        manager_type: editing?.manager_type || "principal",
        include_child_areas: editing?.include_child_areas ?? true,
        start_date: editing?.start_date || new Date().toISOString().slice(0, 10),
        end_date: editing?.end_date || "",
      });
    }
  }, [open, editing]);

  const save = async () => {
    setErr("");
    if (!areaId) return;
    if (!form.user_id) { setErr("Selecione um usuário."); return; }
    setSaving(true);
    const payload = {
      area_id: areaId,
      user_id: form.user_id,
      manager_type: form.manager_type,
      include_child_areas: form.include_child_areas,
      start_date: form.start_date,
      end_date: form.end_date || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("area_manager").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("area_manager").insert({ ...payload, created_by: creatorId }));
    }
    setSaving(false);
    if (error) { setErr(error.message); return; }
    toast.success(editing ? "Gestor atualizado." : "Gestor vinculado.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar gestor" : "Novo gestor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {err && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="space-y-1.5">
            <Label>Usuário *</Label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de gestão</Label>
              <Select value={form.manager_type} onValueChange={(v: Manager["manager_type"]) => setForm({ ...form, manager_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="substitute">Substituto</SelectItem>
                  <SelectItem value="support">Apoio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Inclui áreas subordinadas</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={form.include_child_areas} onCheckedChange={(v) => setForm({ ...form, include_child_areas: v })} />
                <span className="text-sm text-muted-foreground">{form.include_child_areas ? "Sim" : "Apenas esta área"}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Início *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Término (opcional)</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-1"><UserCog className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
