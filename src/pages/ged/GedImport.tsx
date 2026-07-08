import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Loader2, Save, Trash2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useGedAccess } from "@/hooks/useGedAccess";
import { pdfToPngBase64 } from "@/lib/pdfToImages";
import { DuplicateCheckDialog, type DuplicateDoc } from "@/components/ged/DuplicateCheckDialog";
import { TagInput } from "@/components/ged/TagInput";

const TYPES = ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"];
const ORIGINS = ["Parceiro", "Própria instituição"];

type Item = {
  id: string;
  file: File;
  status: "pending" | "analyzing" | "ready" | "saving" | "saved" | "error";
  error?: string;
  documentId?: string;
  meta: {
    titulo: string;
    tipo_documento: string;
    origem_documento: string;
    parceiro_nome?: string;
    produto_nome?: string;
    instituicao_nome?: string;
    numero_documento?: string;
    orgao_emissor?: string;
    data_emissao?: string;
    data_validade?: string;
    descricao?: string;
    tags?: string[];
  };
};

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

async function ensureEntity(table: "ged_partner" | "ged_product" | "ged_institution", name: string): Promise<string> {
  const { data: existing } = await (supabase as any).from(table).select("id").ilike("name", name.trim()).limit(1);
  if (existing?.[0]?.id) return existing[0].id;
  const { data: created, error } = await (supabase as any).from(table).insert({ name: name.trim() }).select("id").single();
  if (error) throw error;
  return created.id;
}

export default function GedImport() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { canManage } = useGedAccess();

  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const [dupModalOpen, setDupModalOpen] = useState(false);
  const [existingDup, setExistingDup] = useState<DuplicateDoc | null>(null);
  const dupResolver = useRef<((val: "replace" | "keep" | "cancel") => void) | null>(null);

  const partnersQ = useQuery({
    queryKey: ["ged_partners_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_partner").select("name").order("name");
      return (data ?? []).map((x: any) => x.name) as string[];
    },
  });
  const productsQ = useQuery({
    queryKey: ["ged_products_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_product").select("name").order("name");
      return (data ?? []).map((x: any) => x.name) as string[];
    },
  });
  const instQ = useQuery({
    queryKey: ["ged_institutions_all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ged_institution").select("name").order("name");
      return (data ?? []).map((x: any) => x.name) as string[];
    },
  });

  if (!canManage) {
    return <div className="p-6"><p>Sem permissão para importar.</p></div>;
  }

  function addFiles(fs: FileList | null) {
    if (!fs) return;
    const arr: Item[] = Array.from(fs).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
      meta: { titulo: f.name.replace(/\.[^.]+$/, ""), tipo_documento: "", origem_documento: "" },
    }));
    setItems((prev) => [...prev, ...arr]);
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function updateMeta(id: string, patch: Partial<Item["meta"]>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: it.status === "error" ? "ready" : it.status, meta: { ...it.meta, ...patch } } : it)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function analyzeOne(item: Item) {
    update(item.id, { status: "analyzing", error: undefined });
    try {
      const isPdf = item.file.type === "application/pdf" || item.file.name.toLowerCase().endsWith(".pdf");
      let invokeBody: any;
      if (isPdf) {
        const pages = await pdfToPngBase64(item.file, { maxPages: 5, scale: 2 });
        invokeBody = {
          filename: item.file.name,
          images: pages.map((b) => ({ base64: b, mime_type: "image/png" })),
          partners: partnersQ.data ?? [],
          products: productsQ.data ?? [],
          institutions: instQ.data ?? [],
        };
      } else {
        const b64 = await fileToBase64(item.file);
        invokeBody = {
          file_base64: b64,
          mime_type: item.file.type || "application/octet-stream",
          filename: item.file.name,
          partners: partnersQ.data ?? [],
          products: productsQ.data ?? [],
          institutions: instQ.data ?? [],
        };
      }
      const { data, error } = await supabase.functions.invoke("ged-extract-metadata", { body: invokeBody });
      if (error) throw error;
      const m = data?.metadata ?? {};
      update(item.id, {
        status: "ready",
        meta: {
          titulo: m.titulo || item.meta.titulo,
          tipo_documento: TYPES.includes(m.tipo_documento) ? m.tipo_documento : "",
          origem_documento: ORIGINS.includes(m.origem_documento) ? m.origem_documento : "",
          parceiro_nome: m.parceiro_nome || undefined,
          produto_nome: m.produto_nome || undefined,
          instituicao_nome: m.instituicao_nome || undefined,
          numero_documento: m.numero_documento,
          orgao_emissor: m.orgao_emissor,
          data_emissao: m.data_emissao,
          data_validade: m.data_validade,
          descricao: m.descricao,
          tags: m.tags ?? [],
        },
      });
    } catch (e: any) {
      update(item.id, { status: "error", error: e?.message ?? "Falha na análise." });
    }
  }

  async function analyzeAll() {
    setBusy(true);
    for (const it of items) {
      if (it.status === "pending" || it.status === "error") {
        // sequential to respect rate limits
        // eslint-disable-next-line no-await-in-loop
        await analyzeOne(it);
      }
    }
    setBusy(false);
  }

  async function promptDuplicate(existing: DuplicateDoc): Promise<"replace" | "keep" | "cancel"> {
    return new Promise((resolve) => {
      setExistingDup(existing);
      setDupModalOpen(true);
      dupResolver.current = (val) => {
        setDupModalOpen(false);
        setExistingDup(null);
        dupResolver.current = null;
        resolve(val);
      };
    });
  }

  async function saveOne(item: Item, forcedAction?: "replace" | "keep") {
    update(item.id, { status: "saving", error: undefined });
    try {
      const m = item.meta;
      if (!m.titulo) throw new Error("Título obrigatório.");
      if (!m.tipo_documento) throw new Error("Tipo obrigatório.");
      if (!m.origem_documento) throw new Error("Origem obrigatória.");
      if (!m.instituicao_nome) throw new Error("Instituição obrigatória.");
      if (m.origem_documento === "Parceiro" && !m.parceiro_nome) throw new Error("Parceiro obrigatório.");

      const instId = await ensureEntity("ged_institution", m.instituicao_nome);
      const parcId = m.parceiro_nome ? await ensureEntity("ged_partner", m.parceiro_nome) : null;
      const prodId = m.produto_nome ? await ensureEntity("ged_product", m.produto_nome) : null;

      // Check duplicate
      let action = forcedAction;
      let existingDocId: string | undefined;
      const num = (m.numero_documento ?? "").trim() || null;
      let dupQ = (supabase as any)
        .from("ged_document")
        .select("id,titulo,tipo_documento,numero_documento,status,instituicao:ged_institution(name),parceiro:ged_partner(name)")
        .ilike("titulo", m.titulo.trim())
        .eq("tipo_documento", m.tipo_documento)
        .eq("instituicao_id", instId);
      if (num) dupQ = dupQ.eq("numero_documento", num);
      else dupQ = dupQ.is("numero_documento", null);
      const { data: dupRows } = await dupQ.limit(1);
      const dup = (dupRows ?? [])[0];

      if (!action) {
        if (dup) {
          const choice = await promptDuplicate(dup);
          if (choice === "cancel") {
            update(item.id, { status: "ready" });
            return;
          }
          action = choice;
          existingDocId = dup.id;
        }
      } else {
        existingDocId = dup?.id;
      }

      let docId: string;
      let finalTitulo = m.titulo;
      let createdNewDoc = false;

      if (action === "replace" && existingDocId) {
        // Update existing document metadata
        const { error: updErr } = await (supabase as any)
          .from("ged_document")
          .update({
            titulo: m.titulo,
            tipo_documento: m.tipo_documento,
            origem_documento: m.origem_documento,
            parceiro_id: parcId,
            produto_id: prodId,
            instituicao_id: instId,
            numero_documento: m.numero_documento || null,
            orgao_emissor: m.orgao_emissor || null,
            data_emissao: m.data_emissao || null,
            data_validade: m.data_validade || null,
            status: "Vigente",
            descricao: m.descricao || null,
            tags: m.tags ?? [],
            atualizado_por: user?.id ?? null,
          })
          .eq("id", existingDocId);
        if (updErr) throw updErr;
        docId = existingDocId;
      } else {
        if (action === "keep") {
          // Find alternative title
          const baseTitulo = m.titulo.trim();
          const { data: siblings } = await (supabase as any)
            .from("ged_document")
            .select("titulo")
            .ilike("titulo", `${baseTitulo}%`)
            .eq("tipo_documento", m.tipo_documento)
            .eq("instituicao_id", instId);
          const existingTitles = (siblings ?? []).map((x: any) => x.titulo as string);
          let suffix = 2;
          while (existingTitles.includes(finalTitulo)) {
            finalTitulo = `${baseTitulo} (${suffix})`;
            suffix++;
          }
        }

        const { data: doc, error: e1 } = await (supabase as any)
          .from("ged_document")
          .insert({
            titulo: finalTitulo,
            tipo_documento: m.tipo_documento,
            origem_documento: m.origem_documento,
            parceiro_id: parcId,
            produto_id: prodId,
            instituicao_id: instId,
            numero_documento: m.numero_documento || null,
            orgao_emissor: m.orgao_emissor || null,
            data_emissao: m.data_emissao || null,
            data_validade: m.data_validade || null,
            status: "Vigente",
            descricao: m.descricao || null,
            tags: m.tags ?? [],
            criado_por: user?.id ?? null,
            atualizado_por: user?.id ?? null,
          })
          .select("id")
          .single();
        if (e1) throw e1;
        docId = doc.id as string;
        createdNewDoc = true;
      }

      const safeName = item.file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const versions = action === "replace" && existingDocId
        ? (await (supabase as any).from("ged_document_version").select("numero_versao").eq("documento_id", existingDocId).order("numero_versao", { ascending: false }).limit(1)).data ?? []
        : [];
      const nextVersion = (action === "replace" && existingDocId) ? ((versions[0]?.numero_versao ?? 0) + 1) : 1;
      const path = `${docId}/v${nextVersion}-${safeName}`;

      try {
        const { error: upErr } = await supabase.storage.from("ged-documents").upload(path, item.file, { upsert: false });
        if (upErr) throw upErr;

        if (action === "replace" && existingDocId) {
          await (supabase as any)
            .from("ged_document_version")
            .update({ versao_atual: false })
            .eq("documento_id", existingDocId)
            .eq("versao_atual", true);
        }

        const { error: e2 } = await (supabase as any).from("ged_document_version").insert({
          documento_id: docId,
          numero_versao: nextVersion,
          arquivo_url: path,
          nome_arquivo: item.file.name,
          tamanho_arquivo: item.file.size,
          tipo_arquivo: item.file.type,
          versao_atual: true,
          enviado_por: user?.id ?? null,
        });
        if (e2) throw e2;
      } catch (err) {
        if (createdNewDoc && docId) {
          await supabase.storage.from("ged-documents").remove([path]).catch(() => {});
          await (supabase as any).from("ged_document").delete().eq("id", docId);
        }
        throw err;
      }

      const texto = [finalTitulo, m.tipo_documento, m.parceiro_nome, m.produto_nome, m.orgao_emissor, m.descricao, ...(m.tags ?? [])]
        .filter(Boolean).join(" | ");

      if (action === "replace" && existingDocId) {
        await (supabase as any)
          .from("ged_document_index")
          .update({
            texto_indexado: texto,
            palavras_chave: m.tags ?? [],
            entidades_identificadas: {
              parceiro: m.parceiro_nome ?? "", produto: m.produto_nome ?? "", instituicao: m.instituicao_nome ?? "",
              tipo_documento: m.tipo_documento, origem_documento: m.origem_documento, status: "Vigente",
              data_validade: m.data_validade ?? null,
            },
            status_indexacao: "Indexado",
            indexado_em: new Date().toISOString(),
          })
          .eq("documento_id", existingDocId);
      } else {
        await (supabase as any).from("ged_document_index").insert({
          documento_id: docId,
          texto_indexado: texto,
          palavras_chave: m.tags ?? [],
          entidades_identificadas: {
            parceiro: m.parceiro_nome ?? "", produto: m.produto_nome ?? "", instituicao: m.instituicao_nome ?? "",
            tipo_documento: m.tipo_documento, origem_documento: m.origem_documento, status: "Vigente",
            data_validade: m.data_validade ?? null,
          },
          status_indexacao: "Indexado",
          indexado_em: new Date().toISOString(),
        });
      }

      update(item.id, { status: "saved", documentId: docId });
    } catch (e: any) {
      update(item.id, { status: "error", error: e?.message ?? "Erro ao salvar." });
    }
  }

  async function saveAll() {
    setBusy(true);
    for (const it of items) {
      if (it.status === "pending" || it.status === "ready") {
        // eslint-disable-next-line no-await-in-loop
        await saveOne(it);
      }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["ged_documents"] });
    qc.invalidateQueries({ queryKey: ["ged_partners_all"] });
    qc.invalidateQueries({ queryKey: ["ged_products_all"] });
    qc.invalidateQueries({ queryKey: ["ged_institutions_all"] });
    toast.success("Importação concluída.");
  }

  const totals = {
    total: items.length,
    ready: items.filter((i) => i.status === "pending" || i.status === "ready").length,
    saved: items.filter((i) => i.status === "saved").length,
    error: items.filter((i) => i.status === "error").length,
  };
  const progress = items.length ? Math.round((totals.saved / items.length) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Importar documentos com IA"
        description="Suba vários arquivos. A IA extrai os metadados e você revisa antes de salvar."
        actions={
          <Button variant="ghost" onClick={() => navigate("/ged")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <Label>Selecionar arquivos (PDF, imagem, texto)</Label>
              <Input
                type="file"
                multiple
                accept=".pdf,image/*,.txt,.md,.json,.csv,.docx"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={analyzeAll} disabled={busy || items.every((i) => i.status !== "pending" && i.status !== "error")}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Analisar todos
              </Button>
              <Button variant="default" onClick={saveAll} disabled={busy || totals.ready === 0}>
                <Save className="h-4 w-4 mr-2" /> Salvar preenchidos ({totals.ready})
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{totals.saved} de {totals.total} salvos · {totals.error} com erro</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {items.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{it.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(it.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {it.status === "pending" && <Badge variant="outline">Pendente</Badge>}
                  {it.status === "analyzing" && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Analisando</Badge>}
                  {it.status === "ready" && <Badge>Pronto</Badge>}
                  {it.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Salvando</Badge>}
                  {it.status === "saved" && <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Salvo</Badge>}
                  {it.status === "saved" && it.documentId && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/ged/${it.documentId}`)}>
                      Abrir
                    </Button>
                  )}
                  {it.status === "error" && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>}
                  {it.status !== "saved" && (
                    <>
                      {(it.status === "pending" || it.status === "error") && (
                        <Button size="sm" variant="ghost" onClick={() => analyzeOne(it)} disabled={busy}>
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(it.id)} disabled={busy}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {it.error && <p className="text-xs text-destructive">{it.error}</p>}

              {it.status !== "saved" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label className="text-xs">Título</Label>
                    <Input value={it.meta.titulo} onChange={(e) => updateMeta(it.id, { titulo: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={it.meta.tipo_documento} onValueChange={(v) => updateMeta(it.id, { tipo_documento: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Origem</Label>
                    <Select value={it.meta.origem_documento} onValueChange={(v) => updateMeta(it.id, { origem_documento: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Empresa contratante (recebeu o serviço) *</Label>
                    <Input value={it.meta.instituicao_nome ?? ""} onChange={(e) => updateMeta(it.id, { instituicao_nome: e.target.value })} placeholder="Cria se não existir" />
                  </div>
                  <div>
                    <Label className="text-xs">Empresa prestadora (executou o serviço)</Label>
                    <Input value={it.meta.parceiro_nome ?? ""} onChange={(e) => updateMeta(it.id, { parceiro_nome: e.target.value })} placeholder="Cria se não existir" />
                  </div>
                  <div>
                    <Label className="text-xs">Produto</Label>
                    <Input value={it.meta.produto_nome ?? ""} onChange={(e) => updateMeta(it.id, { produto_nome: e.target.value })} placeholder="Cria se não existir" />
                  </div>
                  <div>
                    <Label className="text-xs">Número</Label>
                    <Input value={it.meta.numero_documento ?? ""} onChange={(e) => updateMeta(it.id, { numero_documento: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Órgão emissor</Label>
                    <Input value={it.meta.orgao_emissor ?? ""} onChange={(e) => updateMeta(it.id, { orgao_emissor: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Emissão</Label>
                    <Input type="date" value={it.meta.data_emissao ?? ""} onChange={(e) => updateMeta(it.id, { data_emissao: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input type="date" value={it.meta.data_validade ?? ""} onChange={(e) => updateMeta(it.id, { data_validade: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Tags</Label>
                    <TagInput
                      value={it.meta.tags ?? []}
                      onChange={(arr) => updateMeta(it.id, { tags: arr })}
                      placeholder="Digite tags separadas por vírgula"
                    />
                  </div>
                  {(it.status === "pending" || it.status === "ready" || it.status === "error") && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button size="sm" onClick={() => saveOne(it)} disabled={busy}>
                        <Save className="h-4 w-4 mr-2" /> Salvar este
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <DuplicateCheckDialog
        open={dupModalOpen}
        onOpenChange={setDupModalOpen}
        existing={existingDup}
        onReplace={() => dupResolver.current?.("replace")}
        onKeepBoth={() => dupResolver.current?.("keep")}
        onCancel={() => dupResolver.current?.("cancel")}
      />
    </div>
  );
}
