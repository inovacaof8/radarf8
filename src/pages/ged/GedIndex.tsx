import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import EmptyState from "@/components/ui/EmptyState";
import { Plus, Search, Sparkles, FolderArchive, Eye, AlertCircle, Settings2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useGedAccess } from "@/hooks/useGedAccess";

const TYPES = ["Certidão", "Atestado de capacidade técnica", "Laudo", "INMETRO", "Outro"];
const ORIGINS = ["Parceiro", "Própria instituição"];
const STATUSES = ["Vigente", "Vencido", "Substituído", "Inativo"];

function statusVariant(s: string) {
  switch (s) {
    case "Vigente": return "bg-success text-success-foreground";
    case "Vencido": return "bg-destructive text-destructive-foreground";
    case "Substituído": return "bg-muted text-muted-foreground";
    case "Inativo": return "bg-secondary text-secondary-foreground";
    default: return "bg-secondary text-secondary-foreground";
  }
}

export default function GedIndex() {
  const navigate = useNavigate();
  const { canView, canManage } = useGedAccess();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOrigin, setFilterOrigin] = useState<string>("all");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterValidity, setFilterValidity] = useState<string>("all"); // all|expired|next30|next90

  // AI search
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const partnersQ = useQuery({
    queryKey: ["ged_partners"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ged_partner").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  const productsQ = useQuery({
    queryKey: ["ged_products"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ged_product").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const docsQ = useQuery({
    queryKey: ["ged_documents"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ged_document")
        .select(
          "id, titulo, tipo_documento, origem_documento, status, data_validade, orgao_emissor, descricao, tags, parceiro_id, produto_id, parceiro:ged_partner(name), produto:ged_product(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    const docs = docsQ.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const days = (d: number) => {
      const t = new Date();
      t.setDate(t.getDate() + d);
      return t.toISOString().slice(0, 10);
    };
    return docs.filter((d) => {
      if (filterType !== "all" && d.tipo_documento !== filterType) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterOrigin !== "all" && d.origem_documento !== filterOrigin) return false;
      if (filterPartner !== "all" && d.parceiro_id !== filterPartner) return false;
      if (filterProduct !== "all" && d.produto_id !== filterProduct) return false;
      if (filterValidity === "expired" && (!d.data_validade || d.data_validade >= today)) return false;
      if (filterValidity === "next30" && (!d.data_validade || d.data_validade < today || d.data_validade > days(30))) return false;
      if (filterValidity === "next90" && (!d.data_validade || d.data_validade < today || d.data_validade > days(90))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          d.titulo, d.tipo_documento, d.orgao_emissor, d.descricao,
          d.parceiro?.name, d.produto?.name, ...(d.tags ?? []),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docsQ.data, search, filterType, filterStatus, filterOrigin, filterPartner, filterProduct, filterValidity]);

  async function runAiSearch() {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("ged-ai-search", { body: { query: aiQuery } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiResults((data as any).results ?? []);
    } catch (e: any) {
      const msg = e?.message || "Falha ao consultar a IA.";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

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
        title="GED"
        description="Gestão de documentos técnicos"
        actions={
          <div className="flex gap-2">
            {canManage && (
              <Button variant="outline" onClick={() => navigate("/ged/cadastros")}>
                <Settings2 className="h-4 w-4 mr-2" /> Cadastros
              </Button>
            )}
            {canManage && (
              <Button variant="outline" onClick={() => navigate("/ged/importar")}>
                <Sparkles className="h-4 w-4 mr-2" /> Importar com IA
              </Button>
            )}
            {canManage && (
              <Button onClick={() => navigate("/ged/novo")}>
                <Plus className="h-4 w-4 mr-2" /> Novo documento
              </Button>
            )}
          </div>
        }
      />

      {/* Busca tradicional */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por produto, parceiro, documento, órgão emissor ou palavra-chave"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger><SelectValue placeholder="Parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos parceiros</SelectItem>
                {(partnersQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos produtos</SelectItem>
                {(productsQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterValidity} onValueChange={setFilterValidity}>
              <SelectTrigger><SelectValue placeholder="Validade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda validade</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="next30">Vence em 30 dias</SelectItem>
                <SelectItem value="next90">Vence em 90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrigin} onValueChange={setFilterOrigin}>
              <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Busca inteligente */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Busca inteligente</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Descreva o documento que você está procurando e a IA ajudará a localizar os resultados mais relevantes.
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder='Exemplo: certidões válidas do parceiro Alfa para o produto Bomba X'
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
            />
            <Button onClick={runAiSearch} disabled={aiLoading || !aiQuery.trim()}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLoading ? "Buscando..." : "Buscar com IA"}
            </Button>
          </div>

          {aiLoading && <Skeleton className="h-24 w-full" />}
          {aiError && <p className="text-sm text-destructive">{aiError}</p>}
          {aiResults && !aiLoading && (
            <div className="space-y-2 mt-2">
              <h3 className="font-semibold text-sm">Resultados da busca inteligente</h3>
              {aiResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  A busca inteligente não encontrou documentos relacionados.
                </p>
              ) : (
                aiResults.map((d) => (
                  <Card key={d.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/ged/${d.id}`} className="font-semibold hover:underline">{d.titulo}</Link>
                        <Badge variant="outline">{d.tipo_documento}</Badge>
                        <Badge className={statusVariant(d.status)}>{d.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.parceiro?.name && <>Parceiro: {d.parceiro.name} • </>}
                        {d.produto?.name && <>Produto: {d.produto.name} • </>}
                        {d.data_validade && <>Validade: {new Date(d.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}</>}
                      </div>
                      <p className="text-xs italic text-muted-foreground">{d.motivo_resultado}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/ged/${d.id}`}>Abrir documento</Link>
                    </Button>
                  </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Listagem */}
      <Card>
        <CardContent className="p-0">
          {docsQ.isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : docsQ.error ? (
            <EmptyState icon={AlertCircle} title="Erro ao carregar" description="Tente novamente em alguns instantes." />
          ) : (docsQ.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FolderArchive}
              title="Nenhum documento cadastrado"
              description="Crie o primeiro documento técnico do GED."
              action={canManage ? <Button onClick={() => navigate("/ged/novo")}><Plus className="h-4 w-4 mr-2" />Novo documento</Button> : undefined}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderArchive}
              title="Nenhum documento corresponde aos filtros aplicados"
              description="Ajuste os filtros e tente novamente."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Órgão emissor</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isLate = d.data_validade && d.data_validade < today;
                  return (
                    <TableRow key={d.id} className={isLate ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{d.titulo}</TableCell>
                      <TableCell>{d.tipo_documento}</TableCell>
                      <TableCell>{d.parceiro?.name ?? "—"}</TableCell>
                      <TableCell>{d.produto?.name ?? "—"}</TableCell>
                      <TableCell>{d.orgao_emissor ?? "—"}</TableCell>
                      <TableCell>
                        {d.data_validade
                          ? new Date(d.data_validade + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell><Badge className={statusVariant(d.status)}>{d.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/ged/${d.id}`}>
                              <Eye className="h-4 w-4 mr-1" /> Abrir
                            </Link>
                          </Button>
                          {canManage && (
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/ged/${d.id}?edit=1`}>
                                <Pencil className="h-4 w-4 mr-1" /> Editar
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
