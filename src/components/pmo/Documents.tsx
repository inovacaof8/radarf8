import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, Upload, Download, FileText, History, Shield, Send, Check, X, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

// Sanitiza nome de arquivo para chave de storage (Supabase rejeita acentos, º, espaços e símbolos)
function sanitizeStorageName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "arquivo";
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]+/g, "");
  return `${cleanBase}${cleanExt}`.slice(0, 200);
}

type Doc = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  current_version_id: string | null;
  created_by: string | null;
  created_at: string;
};

type Version = {
  id: string;
  document_id: string;
  version_no: number;
  file_name: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    rascunho: "bg-muted text-muted-foreground",
    em_aprovacao: "bg-warning text-warning-foreground",
    aprovado: "bg-success text-success-foreground",
    reprovado: "bg-destructive text-destructive-foreground",
    arquivado: "bg-secondary",
  };
  return map[s] || "bg-muted";
};

const statusLabel = (s: string) =>
  ({ rascunho: "Rascunho", em_aprovacao: "Em aprovação", aprovado: "Aprovado", reprovado: "Reprovado", arquivado: "Arquivado" } as any)[s] || s;

export default function Documents({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openDoc, setOpenDoc] = useState<Doc | null>(null);

  const docs = useQuery({
    queryKey: ["docs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document")
        .select("id, title, description, status, current_version_id, created_by, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Doc[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documentos</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)} className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold">
          <Plus className="h-4 w-4 mr-1" /> Novo documento
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {docs.isLoading ? (
          <div className="p-4"><Skeleton className="h-20" /></div>
        ) : !docs.data?.length ? (
          <p className="p-12 text-sm text-muted-foreground text-center">Nenhum documento ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.data.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setOpenDoc(d)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{d.title}</p>
                        {d.description && <p className="text-xs text-muted-foreground line-clamp-1">{d.description}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={`${statusBadge(d.status)} text-[10px] uppercase`}>{statusLabel(d.status)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(parseISO(d.created_at), "dd/MM/yy HH:mm")}
                  </TableCell>
                  <TableCell><Download className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CreateDocDialog
        open={creating}
        projectId={projectId}
        onClose={() => setCreating(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["docs", projectId] })}
      />

      {openDoc && (
        <DocDetailDialog
          doc={openDoc}
          projectId={projectId}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </Card>
  );
}

// ============== CREATE ==============
function CreateDocDialog({
  open, projectId, onClose, onCreated,
}: { open: boolean; projectId: string; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Título obrigatório");
      if (!file) throw new Error("Selecione um arquivo");
      if (!user) throw new Error("Não autenticado");

      // 1. Insert document
      const { data: doc, error: e1 } = await supabase
        .from("document")
        .insert({
          project_id: projectId,
          title: title.trim(),
          description: description || null,
          status: "rascunho",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      // 2. Upload to storage (sanitize filename for storage key — keep original in file_name)
      const safeName = sanitizeStorageName(file.name);
      const path = `${projectId}/${doc.id}/v1-${safeName}`;
      const { error: e2 } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (e2) throw e2;

      // 3. Create version
      const { data: ver, error: e3 } = await supabase
        .from("document_version")
        .insert({
          document_id: doc.id,
          version_no: 1,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (e3) throw e3;

      // 4. Set current_version_id
      await supabase.from("document").update({ current_version_id: ver.id }).eq("id", doc.id);
    },
    onSuccess: () => {
      toast.success("Documento criado");
      onCreated();
      setTitle(""); setDescription(""); setFile(null);
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Arquivo *</Label>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {file ? file.name : "Selecionar arquivo"}
            </Button>
            {file && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {file.type || "—"}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
            disabled={create.isPending || !title.trim() || !file}
            onClick={() => create.mutate()}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== DETAIL ==============
function DocDetailDialog({
  doc, projectId, onClose,
}: { doc: Doc; projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const newVerInputRef = useRef<HTMLInputElement>(null);
  const [newVerFile, setNewVerFile] = useState<File | null>(null);
  const [aclUserId, setAclUserId] = useState("");
  const [aclPerm, setAclPerm] = useState<"read" | "edit" | "admin">("read");
  const [approverId, setApproverId] = useState("");

  // Versions
  const versions = useQuery({
    queryKey: ["doc-versions", doc.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_version")
        .select("*")
        .eq("document_id", doc.id)
        .order("version_no", { ascending: false });
      return (data || []) as Version[];
    },
  });

  // ACL
  const acl = useQuery({
    queryKey: ["doc-acl", doc.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_acl")
        .select("id, user_id, permission")
        .eq("document_id", doc.id);
      const ids = (data || []).map((a) => a.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, name, email").in("user_id", ids);
      return (data || []).map((a) => ({ ...a, profile: profs?.find((p) => p.user_id === a.user_id) ?? null }));
    },
  });

  // Approvals (current version)
  const approvals = useQuery({
    queryKey: ["doc-approvals", doc.current_version_id],
    enabled: !!doc.current_version_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("document_approval")
        .select("id, approver_id, step, decision, comment, decided_at, created_at")
        .eq("version_id", doc.current_version_id!)
        .order("step");
      const ids = (data || []).map((a) => a.approver_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, name, email").in("user_id", ids)
        : { data: [] };
      return (data || []).map((a) => ({ ...a, profile: profs?.find((p) => p.user_id === a.approver_id) ?? null }));
    },
  });

  const profiles = useSelectableUsers();

  const downloadVersion = async (v: Version) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(v.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const uploadNewVersion = useMutation({
    mutationFn: async () => {
      if (!newVerFile || !user) throw new Error("Selecione um arquivo");
      const nextNo = (versions.data?.[0]?.version_no || 0) + 1;
      const safeName = sanitizeStorageName(newVerFile.name);
      const path = `${projectId}/${doc.id}/v${nextNo}-${safeName}`;
      const { error: eUp } = await supabase.storage.from("documents").upload(path, newVerFile, { upsert: false });
      if (eUp) throw eUp;
      const { data: ver, error: eIns } = await supabase
        .from("document_version")
        .insert({
          document_id: doc.id,
          version_no: nextNo,
          storage_path: path,
          file_name: newVerFile.name,
          mime_type: newVerFile.type,
          file_size_bytes: newVerFile.size,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (eIns) throw eIns;
      await supabase.from("document").update({
        current_version_id: ver.id,
        status: "rascunho",
      }).eq("id", doc.id);
    },
    onSuccess: () => {
      toast.success("Nova versão enviada");
      setNewVerFile(null);
      qc.invalidateQueries({ queryKey: ["doc-versions", doc.id] });
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const addAcl = useMutation({
    mutationFn: async () => {
      if (!aclUserId) throw new Error("Selecione um usuário");
      const { error } = await supabase.from("document_acl").insert({
        document_id: doc.id,
        user_id: aclUserId,
        permission: aclPerm,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissão concedida");
      setAclUserId("");
      qc.invalidateQueries({ queryKey: ["doc-acl", doc.id] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeAcl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_acl").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissão removida");
      qc.invalidateQueries({ queryKey: ["doc-acl", doc.id] });
    },
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      if (!approverId) throw new Error("Selecione um aprovador");
      if (!doc.current_version_id) throw new Error("Sem versão atual");
      const nextStep = ((approvals.data || []).reduce((m, a) => Math.max(m, a.step), 0)) + 1;
      const { error } = await supabase.from("document_approval").insert({
        version_id: doc.current_version_id,
        approver_id: approverId,
        step: nextStep,
        decision: "pendente",
      });
      if (error) throw error;
      await supabase.from("document").update({ status: "em_aprovacao" }).eq("id", doc.id);
    },
    onSuccess: () => {
      toast.success("Enviado para aprovação");
      setApproverId("");
      qc.invalidateQueries({ queryKey: ["doc-approvals", doc.current_version_id] });
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision, comment }: { id: string; decision: "aprovado" | "reprovado"; comment: string }) => {
      const { error } = await supabase
        .from("document_approval")
        .update({ decision, comment, decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      // Update document status if all decisions in or any rejected
      const all = approvals.data || [];
      const updated = all.map((a) => (a.id === id ? { ...a, decision } : a));
      const anyReproved = updated.some((a) => a.decision === "reprovado");
      const allApproved = updated.every((a) => a.decision === "aprovado");
      if (anyReproved) {
        await supabase.from("document").update({ status: "reprovado" }).eq("id", doc.id);
      } else if (allApproved) {
        await supabase.from("document").update({ status: "aprovado" }).eq("id", doc.id);
      }
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["doc-approvals", doc.current_version_id] });
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  const removeDoc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("document").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["docs", projectId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> {doc.title}
            <Badge className={`${statusBadge(doc.status)} text-[10px] uppercase ml-2`}>{statusLabel(doc.status)}</Badge>
          </DialogTitle>
          {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
        </DialogHeader>

        <Tabs defaultValue="versions">
          <TabsList>
            <TabsTrigger value="versions"><History className="h-3.5 w-3.5 mr-1" /> Versões</TabsTrigger>
            <TabsTrigger value="approvals"><Send className="h-3.5 w-3.5 mr-1" /> Aprovações</TabsTrigger>
            <TabsTrigger value="acl"><Shield className="h-3.5 w-3.5 mr-1" /> Permissões</TabsTrigger>
          </TabsList>

          {/* VERSIONS */}
          <TabsContent value="versions" className="space-y-3 pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versão</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(versions.data || []).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Badge variant={v.id === doc.current_version_id ? "default" : "outline"} className="font-mono">
                        v{v.version_no}{v.id === doc.current_version_id && " (atual)"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{v.file_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.file_size_bytes ? `${(v.file_size_bytes / 1024).toFixed(1)} KB` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(v.uploaded_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => downloadVersion(v)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="border-t pt-3">
              <Label className="text-xs uppercase font-bold tracking-wider">Enviar nova versão</Label>
              <div className="flex gap-2 mt-2">
                <input
                  ref={newVerInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setNewVerFile(e.target.files?.[0] || null)}
                />
                <Button variant="outline" onClick={() => newVerInputRef.current?.click()} className="flex-1 justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  {newVerFile ? newVerFile.name : "Selecionar arquivo"}
                </Button>
                <Button
                  className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
                  disabled={!newVerFile || uploadNewVersion.isPending}
                  onClick={() => uploadNewVersion.mutate()}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* APPROVALS */}
          <TabsContent value="approvals" className="space-y-3 pt-3">
            {!doc.current_version_id ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem versão para aprovar.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Aprovador</TableHead>
                      <TableHead>Decisão</TableHead>
                      <TableHead>Comentário</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(approvals.data || []).map((a) => (
                      <ApprovalRow
                        key={a.id}
                        approval={a}
                        currentUserId={user?.id || null}
                        onDecide={(decision, comment) => decide.mutate({ id: a.id, decision, comment })}
                      />
                    ))}
                    {!(approvals.data || []).length && (
                      <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                        Nenhum aprovador ainda.
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="border-t pt-3">
                  <Label className="text-xs uppercase font-bold tracking-wider">Adicionar aprovador</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={approverId} onValueChange={setApproverId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                      <SelectContent>
                        {(profiles.data || []).map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>{p.name} — {p.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
                      disabled={!approverId || submitForApproval.isPending}
                      onClick={() => submitForApproval.mutate()}
                    >
                      <Send className="h-4 w-4 mr-1" /> Enviar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ACL */}
          <TabsContent value="acl" className="space-y-3 pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(acl.data || []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{a.profile?.name || a.user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{a.profile?.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{a.permission}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeAcl.mutate(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!(acl.data || []).length && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
                    Sem permissões específicas — herda do projeto.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs uppercase font-bold tracking-wider">Conceder acesso</Label>
              <div className="flex gap-2">
                <Select value={aclUserId} onValueChange={setAclUserId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Usuário" /></SelectTrigger>
                  <SelectContent>
                    {(profiles.data || []).map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={aclPerm} onValueChange={(v: any) => setAclPerm(v)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Leitura</SelectItem>
                    <SelectItem value="edit">Edição</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
                  disabled={!aclUserId || addAcl.isPending}
                  onClick={() => addAcl.mutate()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between sm:justify-between border-t pt-3">
          <Button variant="outline" className="text-destructive" onClick={() => {
            if (confirm("Remover este documento e todas as versões?")) removeDoc.mutate();
          }}>
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalRow({
  approval, currentUserId, onDecide,
}: {
  approval: any;
  currentUserId: string | null;
  onDecide: (decision: "aprovado" | "reprovado", comment: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"aprovado" | "reprovado">("aprovado");
  const [comment, setComment] = useState("");
  const isMine = approval.approver_id === currentUserId && approval.decision === "pendente";

  const decisionBadge = (d: string) =>
    d === "aprovado" ? <Badge className="bg-success text-success-foreground text-[10px] uppercase"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>
    : d === "reprovado" ? <Badge className="bg-destructive text-destructive-foreground text-[10px] uppercase"><X className="h-3 w-3 mr-1" />Reprovado</Badge>
    : <Badge className="bg-warning text-warning-foreground text-[10px] uppercase"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;

  return (
    <>
      <TableRow>
        <TableCell><Badge variant="outline">#{approval.step}</Badge></TableCell>
        <TableCell>
          <p className="font-medium text-sm">{approval.profile?.name || approval.approver_id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{approval.profile?.email}</p>
        </TableCell>
        <TableCell>{decisionBadge(approval.decision)}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{approval.comment || "—"}</TableCell>
        <TableCell>
          {isMine && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Decidir</Button>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decisão de aprovação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Decisão</Label>
              <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovado">Aprovar</SelectItem>
                  <SelectItem value="reprovado">Reprovar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comentário</Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="bg-brand-500 text-ink hover:bg-brand-600 uppercase font-bold"
              onClick={() => { onDecide(decision, comment); setOpen(false); }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
