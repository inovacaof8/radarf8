import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useGedAccess } from "@/hooks/useGedAccess";
import { pdfToPngBase64 } from "@/lib/pdfToImages";
import { DuplicateCheckDialog, useCheckDuplicate, type DuplicateDoc } from "@/components/ged/DuplicateCheckDialog";
import { TagInput } from "@/components/ged/TagInput";

const TYPES = ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"];
const ORIGINS = ["Parceiro", "Própria instituição"];

export default function GedNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canManage } = useGedAccess();

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [parceiroId, setParceiroId] = useState<string>("");
  const [produtoId, setProdutoId] = useState<string>("");
  const [produtoInput, setProdutoInput] = useState<string>("");
  const [instituicaoId, setInstituicaoId] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [orgao, setOrgao] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ parceiro?: string; produto?: string; instituicao?: string } | null>(null);
  const [aiApplied, setAiApplied] = useState(false);

  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [existingDup, setExistingDup] = useState<DuplicateDoc | null>(null);
  const [pendingSave, setPendingSave] = useState<(() => Promise<void>) | null>(null);

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

  if (!canManage) {
    return (
      <div className="p-6">
        <p>Você não tem permissão para criar documentos.</p>
      </div>
    );
  }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  function findByName<T extends { id: string; name: string }>(list: T[] | undefined, name?: string) {
    if (!name || !list) return undefined;
    const n = name.trim().toLowerCase();
    return list.find((x) => x.name.trim().toLowerCase() === n);
  }

  async function ensureEntity(table: "ged_partner" | "ged_product" | "ged_institution", name: string): Promise<string> {
    const { data: existing } = await (supabase as any).from(table).select("id").ilike("name", name.trim()).limit(1);
    if (existing?.[0]?.id) return existing[0].id;
    const { data: created, error } = await (supabase as any).from(table).insert({ name: name.trim() }).select("id").single();
    if (error) throw error;
    return created.id;
  }

  async function analyzeWithAI() {
    if (!file) return toast.error("Selecione um arquivo primeiro.");
    setAiLoading(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let invokeBody: any;
      if (isPdf) {
        const pages = await pdfToPngBase64(file, { maxPages: 5, scale: 2 });
        invokeBody = {
          filename: file.name,
          images: pages.map((b) => ({ base64: b, mime_type: "image/png" })),
          partners: (partnersQ.data ?? []).map((p) => p.name),
          products: (productsQ.data ?? []).map((p) => p.name),
          institutions: (instQ.data ?? []).map((p) => p.name),
        };
      } else {
        const b64 = await fileToBase64(file);
        invokeBody = {
          file_base64: b64,
          mime_type: file.type || "application/octet-stream",
          filename: file.name,
          partners: (partnersQ.data ?? []).map((p) => p.name),
          products: (productsQ.data ?? []).map((p) => p.name),
          institutions: (instQ.data ?? []).map((p) => p.name),
        };
      }
      const { data, error } = await supabase.functions.invoke("ged-extract-metadata", { body: invokeBody });
      if (error) throw error;
      const m = data?.metadata;
      if (!m) throw new Error("Resposta vazia da IA.");

      if (m.titulo) setTitulo(m.titulo);
      if (m.tipo_documento && TYPES.includes(m.tipo_documento)) setTipo(m.tipo_documento);
      if (m.origem_documento && ORIGINS.includes(m.origem_documento)) setOrigem(m.origem_documento);
      if (m.numero_documento) setNumero(m.numero_documento);
      if (m.orgao_emissor) setOrgao(m.orgao_emissor);
      if (m.data_emissao) setDataEmissao(m.data_emissao);
      if (m.data_validade) setDataValidade(m.data_validade);
      if (m.descricao) setDescricao(m.descricao);
      if (Array.isArray(m.tags) && m.tags.length) setTagsInput(m.tags.join(", "));

      // Match existing entities; otherwise mark as suggestion to create
      const sug: { parceiro?: string; produto?: string; instituicao?: string } = {};
      const p = findByName(partnersQ.data, m.parceiro_nome);
      if (p) setParceiroId(p.id); else if (m.parceiro_nome) sug.parceiro = m.parceiro_nome;
      const pr = findByName(productsQ.data, m.produto_nome);
      if (pr) { setProdutoId(pr.id); setProdutoInput(pr.name); } else if (m.produto_nome) { sug.produto = m.produto_nome; setProdutoInput(m.produto_nome); }
      const inst = findByName(instQ.data, m.instituicao_nome);
      if (inst) setInstituicaoId(inst.id); else if (m.instituicao_nome) sug.instituicao = m.instituicao_nome;

      setAiSuggestions(Object.keys(sug).length ? sug : null);
      setAiApplied(true);
      toast.success("Metadados extraídos. Revise antes de salvar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao analisar com IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function resolveEntities() {
    let finalInst = instituicaoId;
    let finalParc = parceiroId;
    let finalProd = produtoId;
    if (!finalInst && aiSuggestions?.instituicao) finalInst = await ensureEntity("ged_institution", aiSuggestions.instituicao);
    if (!finalParc && aiSuggestions?.parceiro) finalParc = await ensureEntity("ged_partner", aiSuggestions.parceiro);
    const produtoTyped = produtoInput.trim();
    if (produtoTyped) {
      const match = findByName(productsQ.data, produtoTyped);
      finalProd = match ? match.id : await ensureEntity("ged_product", produtoTyped);
    } else if (!finalProd && aiSuggestions?.produto) {
      finalProd = await ensureEntity("ged_product", aiSuggestions.produto);
    }
    return { finalInst, finalParc, finalProd };
  }

  async function createDocCore(opts: { docId?: string; overrideTitulo?: string } = {}) {
    const { finalInst, finalParc, finalProd } = await resolveEntities();
    if (!finalInst) throw new Error("Instituição responsável é obrigatória.");
    if (origem === "Parceiro" && !finalParc) throw new Error("Parceiro é obrigatório quando a origem é Parceiro.");
    if (!file) throw new Error("Arquivo da primeira versão é obrigatório.");

    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const docPayload = {
      titulo: opts.overrideTitulo ?? titulo,
      tipo_documento: tipo,
      origem_documento: origem,
      parceiro_id: finalParc || null,
      produto_id: finalProd || null,
      instituicao_id: finalInst,
      numero_documento: numero || null,
      orgao_emissor: orgao || null,
      data_emissao: dataEmissao || null,
      data_validade: dataValidade || null,
      status: "Vigente" as string,
      descricao: descricao || null,
      tags,
      observacoes: observacoes || null,
      criado_por: user?.id ?? null,
      atualizado_por: user?.id ?? null,
    };

    let docId = opts.docId;
    let createdNewDoc = false;
    if (!docId) {
      const { data: doc, error: e1 } = await (supabase as any)
        .from("ged_document")
        .insert(docPayload)
        .select("id")
        .single();
      if (e1) throw e1;
      docId = doc.id as string;
      createdNewDoc = true;
    } else {
      const { error: e1 } = await (supabase as any)
        .from("ged_document")
        .update(docPayload)
        .eq("id", docId);
      if (e1) throw e1;
    }

    const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
    const versions = opts.docId
      ? (await (supabase as any).from("ged_document_version").select("numero_versao").eq("documento_id", opts.docId).order("numero_versao", { ascending: false }).limit(1)).data ?? []
      : [];
    const nextVersion = opts.docId ? ((versions[0]?.numero_versao ?? 0) + 1) : 1;
    const path = `${docId}/v${nextVersion}-${safeName}`;

    try {
      const { error: upErr } = await supabase.storage.from("ged-documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      if (opts.docId) {
        await (supabase as any)
          .from("ged_document_version")
          .update({ versao_atual: false })
          .eq("documento_id", opts.docId)
          .eq("versao_atual", true);
      }

      const { error: e2 } = await (supabase as any).from("ged_document_version").insert({
        documento_id: docId,
        numero_versao: nextVersion,
        arquivo_url: path,
        nome_arquivo: file.name,
        tamanho_arquivo: file.size,
        tipo_arquivo: file.type,
        versao_atual: true,
        enviado_por: user?.id ?? null,
      });
      if (e2) throw e2;
    } catch (err) {
      // Rollback orphan document if we just created it
      if (createdNewDoc && docId) {
        await supabase.storage.from("ged-documents").remove([path]).catch(() => {});
        await (supabase as any).from("ged_document").delete().eq("id", docId);
      }
      throw err;
    }

    const parceiroName = partnersQ.data?.find((p) => p.id === finalParc)?.name ?? aiSuggestions?.parceiro ?? "";
    const produtoName = productsQ.data?.find((p) => p.id === finalProd)?.name ?? aiSuggestions?.produto ?? "";
    const instName = instQ.data?.find((p) => p.id === finalInst)?.name ?? aiSuggestions?.instituicao ?? "";
    const texto = [titulo, tipo, parceiroName, produtoName, orgao, descricao, observacoes, ...tags]
      .filter(Boolean).join(" | ");

    if (opts.docId) {
      await (supabase as any)
        .from("ged_document_index")
        .update({
          texto_indexado: texto,
          palavras_chave: tags,
          entidades_identificadas: {
            parceiro: parceiroName, produto: produtoName, instituicao: instName,
            tipo_documento: tipo, origem_documento: origem, status: "Vigente",
            data_validade: dataValidade || null,
          },
          status_indexacao: "Indexado",
          indexado_em: new Date().toISOString(),
        })
        .eq("documento_id", docId);
    } else {
      await (supabase as any).from("ged_document_index").insert({
        documento_id: docId,
        texto_indexado: texto,
        palavras_chave: tags,
        entidades_identificadas: {
          parceiro: parceiroName, produto: produtoName, instituicao: instName,
          tipo_documento: tipo, origem_documento: origem, status: "Vigente",
          data_validade: dataValidade || null,
        },
        status_indexacao: "Indexado",
        indexado_em: new Date().toISOString(),
      });
    }

    return docId;
  }

  async function handleSave() {
    if (!titulo.trim()) return toast.error("Título é obrigatório.");
    if (!tipo) return toast.error("Tipo de documento é obrigatório.");
    if (!origem) return toast.error("Origem do documento é obrigatória.");
    if (!file) return toast.error("Arquivo da primeira versão é obrigatório.");

    setSaving(true);
    try {
      // Pre-resolve entities so we can use institution id for duplicate check
      const { finalInst } = await resolveEntities();
      if (!finalInst) { setSaving(false); return toast.error("Instituição responsável é obrigatória."); }

      // Check duplicate
      const num = (numero ?? "").trim() || null;
      let dupQ = (supabase as any)
        .from("ged_document")
        .select("id,titulo,tipo_documento,numero_documento,status,instituicao:ged_institution(name),parceiro:ged_partner(name)")
        .ilike("titulo", titulo.trim())
        .eq("tipo_documento", tipo)
        .eq("instituicao_id", finalInst);
      if (num) dupQ = dupQ.eq("numero_documento", num);
      else dupQ = dupQ.is("numero_documento", null);
      const { data: dupRows } = await dupQ.limit(1);
      const dup = (dupRows ?? [])[0];

      if (dup) {
        setExistingDup(dup);
        setDupModalOpen(true);
        setSaving(false);
        return;
      }

      const docId = await createDocCore();
      toast.success("Documento criado com sucesso.");
      navigate(`/ged/${docId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function doReplace() {
    setDupModalOpen(false);
    setSaving(true);
    try {
      const docId = await createDocCore({ docId: existingDup!.id });
      toast.success("Documento substituído com sucesso.");
      navigate(`/ged/${docId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao substituir.");
    } finally {
      setSaving(false);
      setExistingDup(null);
    }
  }

  async function doKeepBoth() {
    setDupModalOpen(false);
    setSaving(true);
    try {
      // Find next suffix
      const baseTitulo = titulo.trim();
      const { data: siblings } = await (supabase as any)
        .from("ged_document")
        .select("titulo")
        .ilike("titulo", `${baseTitulo}%`)
        .eq("tipo_documento", tipo)
        .eq("instituicao_id", instituicaoId);
      const existingTitles = (siblings ?? []).map((x: any) => x.titulo as string);
      let newTitulo = baseTitulo;
      let suffix = 2;
      while (existingTitles.includes(newTitulo)) {
        newTitulo = `${baseTitulo} (${suffix})`;
        suffix++;
      }
      const docId = await createDocCore({ overrideTitulo: newTitulo });
      toast.success("Novo documento criado com título alternativo.");
      navigate(`/ged/${docId}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Erro ao manter ambos.");
    } finally {
      setSaving(false);
      setExistingDup(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Novo documento"
        description="Cadastro de Documento Técnico no GED"
        actions={
          <Button variant="ghost" onClick={() => navigate("/ged")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de documento *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem *</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa contratante (recebeu o serviço) *</Label>
              <Select value={instituicaoId} onValueChange={setInstituicaoId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(instQ.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {(instQ.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma cadastrada. Peça ao administrador para cadastrar.</p>
              )}
            </div>
            <div>
              <Label>Empresa prestadora (executou o serviço) {origem === "Parceiro" && "*"}</Label>
              <Select value={parceiroId} onValueChange={setParceiroId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(partnersQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produto</Label>
              <Input
                list="ged-produtos-list"
                value={produtoInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setProdutoInput(v);
                  const match = findByName(productsQ.data, v);
                  setProdutoId(match?.id ?? "");
                }}
                placeholder="Digite ou selecione um produto"
              />
              <datalist id="ged-produtos-list">
                {(productsQ.data ?? []).map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">Se não existir, será criado ao salvar.</p>
            </div>
            <div>
              <Label>Número do documento</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label>Órgão emissor</Label>
              <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} />
            </div>
            <div>
              <Label>Data de emissão</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <Label>Data de validade</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Tags</Label>
              <TagInput
                value={tagsInput.split(",").map((t) => t.trim()).filter(Boolean)}
                onChange={(arr) => setTagsInput(arr.join(", "))}
                placeholder="Digite tags separadas por vírgula"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Arquivo da primeira versão *</Label>
              <div className="flex gap-2 items-start">
                <Input type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setAiApplied(false); setAiSuggestions(null); }} className="flex-1" />
                <Button type="button" variant="secondary" onClick={analyzeWithAI} disabled={!file || aiLoading}>
                  {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Analisar com IA
                </Button>
              </div>
              {aiApplied && (
                <p className="text-xs text-muted-foreground">
                  Campos preenchidos pela IA. Revise antes de salvar.
                </p>
              )}
              {aiSuggestions && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="font-medium">A IA sugeriu cadastros novos (serão criados ao salvar):</p>
                  {aiSuggestions.instituicao && <Badge variant="secondary">Instituição: {aiSuggestions.instituicao}</Badge>}{" "}
                  {aiSuggestions.parceiro && <Badge variant="secondary">Parceiro: {aiSuggestions.parceiro}</Badge>}{" "}
                  {aiSuggestions.produto && <Badge variant="secondary">Produto: {aiSuggestions.produto}</Badge>}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate("/ged")}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar documento"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DuplicateCheckDialog
        open={dupModalOpen}
        onOpenChange={setDupModalOpen}
        existing={existingDup}
        onReplace={doReplace}
        onKeepBoth={doKeepBoth}
        onCancel={() => { setDupModalOpen(false); setExistingDup(null); }}
      />
    </div>
  );
}
