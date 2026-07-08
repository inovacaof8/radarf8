import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Files, Search, ExternalLink } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  rascunho:   "bg-secondary text-secondary-foreground",
  em_revisao: "bg-warning/20 text-warning",
  aprovado:   "bg-success/20 text-success",
  reprovado:  "bg-destructive/20 text-destructive",
  arquivado:  "bg-muted text-muted-foreground",
};

export default function DocumentsIndex() {
  const [q, setQ] = useState("");

  const docs = useQuery({
    queryKey: ["documents-index"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document")
        .select("id, title, status, updated_at, project_id, portfolio_id, program_id, project:project_id(id, name, code), portfolio:portfolio_id(name), program:program_id(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (docs.data || []).filter((d: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return d.title.toLowerCase().includes(s) || (d.project?.name || "").toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Visão consolidada de todos os documentos visíveis para você."
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por título ou projeto..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {docs.isLoading ? (
            <div className="p-4 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Files className="h-10 w-10 mx-auto mb-2 opacity-30" />
              Nenhum documento encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Hierarquia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.project?.name || <span className="italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.portfolio?.name && <Badge variant="outline" className="text-[10px]">{d.portfolio.name}</Badge>}
                        {d.program?.name && <Badge variant="outline" className="text-[10px]">{d.program.name}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_TONE[d.status] || "bg-secondary"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.updated_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {d.project?.id && (
                        <Link to={`/projetos/${d.project.id}?tab=documentos`} className="text-primary hover:underline">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
