import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, Upload, Ban, Pencil, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useGedAccess } from "@/hooks/useGedAccess";
import { TagInput } from "@/components/ged/TagInput";
import GedShareDialog from "@/components/ged/GedShareDialog";

const STATUSES = ["Vigente", "Vencido", "Substituído", "Inativo"];
const TYPES = ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"];
const ORIGINS = ["Parceiro", "Própria instituição"];

function statusVariant(s: string) {
  switch (s) {
    case "Vigente": return "bg-success text-success-foreground";
    case "Vencido": return "bg-destructive text-destructive-foreground";
    case "Substituído": return "bg-muted text-muted-foreground";
    case "Inativo": return "bg-secondary text-secondary-foreground";
    default: return "bg-secondary text-secondary-foreground";
  }
}

export default function GedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { canView, canManage, canDelete } = useGedAccess();

  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditOpen(true);
    }
  }, [searchParams]);

  const [versionOpen, setVersionOpen] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [uploading, setUploading] = useState(false);

  const docQ = useQuery({
    queryKey: ["ged_doc", id],
    enabled: !!id && canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ged_document")
        .select(
          "*, parceiro:ged_partner(id,name), produto:ged_product(id,name), instituicao:ged_institution(id,name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const myAclQ = useQuery({
    queryKey: ["ged_my_acl", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ged_document_acl")
        .select("permission")
        .eq("documento_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.permission as "read" | "edit" | undefined) ?? null;
    },
  });

  const versionsQ = useQuery({
    queryKey: ["ged_versions", id],
    enabled: !!id && canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ged_document_version")
        .select("*")
        .eq("documento_id", id)
        .order("numero_versao", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  async function download(path: string, filename?: string) {
    const { data, error } = await supabase.storage
      .from("ged-documents")
      .createSignedUrl(path, 300, { download: filename || true });
    if (error || !data) return toast.error("Não foi possível baixar.");

    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function sendNewVersion() {
    if (!newFile) return toast.error("Selecione um arquivo.");
    setUploading(true);
    try {
      const versions = versionsQ.data ?? [];
      const next = (Math.max(0, ...versions.map((v) => v.numero_versao)) || 0) + 1;
      const path = `${id}/v${next}-${newFile.name}`;
      const { error: upErr } = await supabase.storage.from("ged-documents").upload(path, newFile);
      if (upErr) throw upErr;

      // Mark previous current as false
      await (supabase as any)
        .from("ged_document_version")
        .update({ versao_atual: false })
        .eq("documento_id", id)
        .eq("versao_atual", true);

      // Insert new current version
      const { data: ver, error: vErr } = await (supabase as any).from("ged_document_version").insert({
        documento_id: id,
        numero_versao: next,
        arquivo_url: path,
        nome_arquivo: newFile.name,
        tamanho_arquivo: newFile.size,
        tipo_arquivo: newFile.type,
        motivo_nova_versao: motivo || null,
        versao_atual: true,
        enviado_por: user?.id ?? null,
      }).select("id").single();
      if (vErr) throw vErr;

      // Update index
      await (supabase as any)
        .from("ged_document_index")
        .update({
          versao_documento_id: ver.id,
          status_indexacao: "Indexado",
          indexado_em: new Date().toISOString(),
        })
        .eq("documento_id", id);

      toast.success("Nova versão enviada.");
      setVersionOpen(false);
      setNewFile(null);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["ged_versions", id] });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao enviar nova versão.");
    } finally {
      setUploading(false);
    }
  }

  async function inactivate() {
    if (!confirm("Inativar este documento?")) return;
    const { error } = await (supabase as any)
      .from("ged_document")
      .update({ status: "Inativo", atualizado_por: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error("Falha ao inativar.");
    toast.success("Documento inativado.");
    qc.invalidateQueries({ queryKey: ["ged_doc", id] });
  }

  if (!canView) {
    return <div className="p-6"><p>Acesso negado.</p></div>;
  }

  if (docQ.isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!docQ.data) {
    return (
      <div className="p-6">
        <AlertCircle className="h-6 w-6 mb-2 text-destructive" />
        <p>Documento não encontrado.</p>
        <Button variant="ghost" onClick={() => navigate("/ged")} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const d = docQ.data;
  const versions = versionsQ.data ?? [];
  const current = versions.find((v) => v.versao_atual);
  const today = new Date().toISOString().slice(0, 10);
  const isLate = d.data_validade && d.data_validade < today;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={d.titulo}
        description={`${d.tipo_documento} • ${d.origem_documento}`}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/ged")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            {current && (
              <Button onClick={() => download(current.arquivo_url, current.nome_arquivo)}>
                <Download className="h-4 w-4 mr-2" /> Baixar
              </Button>
            )}
          </div>
        }
      />

      <Card className={isLate ? "border-destructive/50" : ""}>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Info label="Status"><Badge className={statusVariant(d.status)}>{d.status}</Badge></Info>
          <Info label="Tipo">{d.tipo_documento}</Info>
          <Info label="Origem">{d.origem_documento}</Info>
          <Info label="Empresa contratante (recebeu o serviço)">{d.instituicao?.name ?? "—"}</Info>
          <Info label="Empresa prestadora (executou o serviço)">{d.parceiro?.name ?? "—"}</Info>
          <Info label="Produto">{d.produto?.name ?? "—"}</Info>
          <Info label="Número">{d.numero_documento ?? "—"}</Info>
          <Info label="Órgão emissor">{d.orgao_emissor ?? "—"}</Info>
          <Info label="Data de emissão">
            {d.data_emissao ? new Date(d.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          </Info>
          <Info label="Data de validade">
            <span className={isLate ? "text-destructive font-semibold" : ""}>
              {d.data_validade ? new Date(d.data_validade + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
            </span>
          </Info>
          <Info label="Descrição" full>{d.descricao ?? "—"}</Info>
          <Info label="Observações" full>{d.observacoes ?? "—"}</Info>
          <Info label="Tags" full>
            <div className="flex flex-wrap gap-1">
              {(d.tags ?? []).length === 0 ? "—" : (d.tags ?? []).map((t: string) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          </Info>
        </CardContent>
      </Card>

      {(() => {
        const isOwner = !!user && d.criado_por === user.id;
        const hasEditAcl = myAclQ.data === "edit";
        const canEditDoc = isOwner || canDelete || hasEditAcl;
        return (
          <div className="flex gap-2 flex-wrap">
            {canEditDoc && <EditMetadataDialog doc={d} open={editOpen} onOpenChange={setEditOpen} />}
            {canEditDoc && (
              <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Enviar nova versão</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Enviar nova versão</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Arquivo *</Label>
                      <Input type="file" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <div>
                      <Label>Motivo da nova versão</Label>
                      <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setVersionOpen(false)}>Cancelar</Button>
                    <Button onClick={sendNewVersion} disabled={uploading}>{uploading ? "Enviando..." : "Enviar"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {(isOwner || canDelete) && (
              <GedShareDialog documentoId={d.id} ownerId={d.criado_por} />
            )}
            {canDelete && d.status !== "Inativo" && (
              <Button variant="destructive" onClick={inactivate}><Ban className="h-4 w-4 mr-2" />Inativar documento</Button>
            )}
          </div>
        );
      })()}

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Versão atual</h2>
          {current ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Info label="Versão">v{current.numero_versao}</Info>
              <Info label="Arquivo">{current.nome_arquivo ?? "—"}</Info>
              <Info label="Tipo">{current.tipo_arquivo ?? "—"}</Info>
              <Info label="Tamanho">{current.tamanho_arquivo ? `${(current.tamanho_arquivo / 1024).toFixed(1)} KB` : "—"}</Info>
              <Info label="Enviado em">{new Date(current.created_at).toLocaleString("pt-BR")}</Info>
              <div className="col-span-2 md:col-span-4 flex gap-2">
                <Button size="sm" onClick={() => download(current.arquivo_url, current.nome_arquivo)}>
                  <Download className="h-4 w-4 mr-2" /> Baixar arquivo
                </Button>
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Sem versão atual.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-3">Histórico de versões</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma versão.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">v{v.numero_versao}</span>
                      {v.versao_atual && <Badge className="bg-success text-success-foreground">Atual</Badge>}
                      <span className="text-sm">{v.nome_arquivo ?? "—"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enviado em {new Date(v.created_at).toLocaleString("pt-BR")}
                      {v.motivo_nova_versao && ` • ${v.motivo_nova_versao}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => download(v.arquivo_url, v.nome_arquivo)}>
                      <Download className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm mt-1">{children}</div>
    </div>
  );
}

function EditMetadataDialog({ doc, open, onOpenChange }: { doc: any; open: boolean; onOpenChange: (b: boolean) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [titulo, setTitulo] = useState(doc.titulo);
  const [tipo, setTipo] = useState(doc.tipo_documento);
  const [origem, setOrigem] = useState(doc.origem_documento);
  const [status, setStatus] = useState(doc.status);
  const [parceiroId, setParceiroId] = useState<string>(doc.parceiro_id ?? "__none__");
  const [produtoInput, setProdutoInput] = useState<string>(doc.produto?.name ?? "");
  const [instituicaoId, setInstituicaoId] = useState<string>(doc.instituicao_id ?? "");
  const [numero, setNumero] = useState(doc.numero_documento ?? "");
  const [orgao, setOrgao] = useState(doc.orgao_emissor ?? "");
  const [emissao, setEmissao] = useState(doc.data_emissao ?? "");
  const [validade, setValidade] = useState(doc.data_validade ?? "");
  const [descricao, setDescricao] = useState(doc.descricao ?? "");
  const [observacoes, setObservacoes] = useState(doc.observacoes ?? "");
  const [tags, setTags] = useState<string[]>(doc.tags ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo(doc.titulo);
    setTipo(doc.tipo_documento);
    setOrigem(doc.origem_documento);
    setStatus(doc.status);
    setParceiroId(doc.parceiro_id ?? "__none__");
    setProdutoInput(doc.produto?.name ?? "");
    setInstituicaoId(doc.instituicao_id ?? "");
    setNumero(doc.numero_documento ?? "");
    setOrgao(doc.orgao_emissor ?? "");
    setEmissao(doc.data_emissao ?? "");
    setValidade(doc.data_validade ?? "");
    setDescricao(doc.descricao ?? "");
    setObservacoes(doc.observacoes ?? "");
    setTags(doc.tags ?? []);
  }, [doc, open]);

  const partnersQ = useQuery({
    queryKey: ["ged_partners_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_partner").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const productsQ = useQuery({
    queryKey: ["ged_products_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_product").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const instQ = useQuery({
    queryKey: ["ged_institutions_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_institution").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  function findProductByName(name: string) {
    const n = name.trim().toLowerCase();
    return (productsQ.data ?? []).find((p) => p.name.trim().toLowerCase() === n);
  }

  async function ensureProduct(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const found = findProductByName(trimmed);
    if (found?.id) return found.id;
    const { data: existing } = await (supabase as any).from("ged_product").select("id").ilike("name", trimmed).limit(1);
    if (existing?.[0]?.id) return existing[0].id;
    const { data: created, error } = await (supabase as any).from("ged_product").insert({ name: trimmed }).select("id").single();
    if (error) throw error;
    return created.id;
  }

  async function save() {
    if (!instituicaoId) return toast.error("Empresa contratante é obrigatória.");
    setSaving(true);
    try {
      const productId = await ensureProduct(produtoInput);
      const { error } = await (supabase as any)
        .from("ged_document")
        .update({
          titulo,
          tipo_documento: tipo,
          origem_documento: origem,
          status,
          parceiro_id: parceiroId === "__none__" ? null : parceiroId,
          produto_id: productId,
          instituicao_id: instituicaoId,
          numero_documento: numero || null,
          orgao_emissor: orgao || null,
          data_emissao: emissao || null,
          data_validade: validade || null,
          descricao: descricao || null,
          observacoes: observacoes || null,
          tags: tags,
          atualizado_por: user?.id ?? null,
        })
        .eq("id", doc.id);
      if (error) throw error;

      const parceiroName = parceiroId === "__none__" ? "" : (partnersQ.data ?? []).find((p) => p.id === parceiroId)?.name ?? "";
      const produtoName = produtoInput.trim();
      const instituicaoName = (instQ.data ?? []).find((i) => i.id === instituicaoId)?.name ?? "";
      const textoIndexado = [titulo, tipo, parceiroName, produtoName, orgao, descricao, observacoes, ...tags]
        .filter(Boolean)
        .join(" | ");

      const { data: existingIndex } = await (supabase as any)
        .from("ged_document_index")
        .select("id")
        .eq("documento_id", doc.id)
        .limit(1);
      const indexPayload = {
        texto_indexado: textoIndexado,
        palavras_chave: tags,
        entidades_identificadas: {
          parceiro: parceiroName,
          produto: produtoName,
          instituicao: instituicaoName,
          tipo_documento: tipo,
          origem_documento: origem,
          status,
          data_validade: validade || null,
        },
        status_indexacao: "Indexado",
        indexado_em: new Date().toISOString(),
      };
      if (existingIndex?.[0]?.id) {
        await (supabase as any).from("ged_document_index").update(indexPayload).eq("documento_id", doc.id);
      } else {
        await (supabase as any).from("ged_document_index").insert({ documento_id: doc.id, ...indexPayload });
      }

      toast.success("Metadados atualizados.");
      qc.invalidateQueries({ queryKey: ["ged_doc", doc.id] });
      qc.invalidateQueries({ queryKey: ["ged_products_all"] });
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil className="h-4 w-4 mr-2" />Editar metadados</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar metadados</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa contratante (recebeu o serviço) *</Label>
            <Select value={instituicaoId} onValueChange={setInstituicaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{(instQ.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa prestadora (executou o serviço)</Label>
            <Select value={parceiroId} onValueChange={setParceiroId}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {(partnersQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Produto</Label>
            <Input
              list="ged-detail-produtos-list"
              value={produtoInput}
              onChange={(e) => setProdutoInput(e.target.value)}
              placeholder="Digite qualquer produto"
            />
            <datalist id="ged-detail-produtos-list">
              {(productsQ.data ?? []).map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <div><Label>Número do documento</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
          <div><Label>Órgão emissor</Label><Input value={orgao} onChange={(e) => setOrgao(e.target.value)} /></div>
          <div><Label>Data de emissão</Label><Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></div>
          <div><Label>Data de validade</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Tags</Label><TagInput value={tags} onChange={setTags} placeholder="Digite tags separadas por vírgula" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
