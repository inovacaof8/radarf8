import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const actions = [...new Set(logs?.map((l) => l.action) || [])];
  const modules = [...new Set(logs?.map((l) => l.module) || [])];

  const { allFiltered, filtered, total, totalPages } = useMemo(() => {
    if (!logs) return { allFiltered: [], filtered: [], total: 0, totalPages: 0 };
    let result = logs;
    if (search) { const s = search.toLowerCase(); result = result.filter((l) => l.user_name.toLowerCase().includes(s) || l.details?.toLowerCase().includes(s)); }
    if (actionFilter !== "all") result = result.filter((l) => l.action === actionFilter);
    if (moduleFilter !== "all") result = result.filter((l) => l.module === moduleFilter);
    const total = result.length;
    const totalPages = Math.ceil(total / pageSize);
    const paged = result.slice((page - 1) * pageSize, page * pageSize);
    return { allFiltered: result, filtered: paged, total, totalPages };
  }, [logs, search, actionFilter, moduleFilter, page]);

  const exportCSV = () => {
    if (!allFiltered.length) { toast.error("Nenhum registro para exportar."); return; }
    const headers = ["Data/Hora", "Usuário", "Ação", "Módulo", "Entidade", "Detalhes", "Valor Anterior", "Novo Valor"];
    const rows = allFiltered.map((l) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.user_name,
      l.action,
      l.module,
      l.entity || "",
      l.details || "",
      l.previous_value || "",
      l.new_value || "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação concluída.");
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Logs e Auditoria</h1><p className="text-muted-foreground">Trilha completa de ações do sistema</p></div>
        <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> Exportar CSV</Button>
      </div>
      <Card><CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" /></div>
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Ação" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as ações</SelectItem>{actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
          <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Módulo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Módulo</TableHead><TableHead>Detalhes</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</TableCell></TableRow> :
                filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{log.user_name}</TableCell>
                    <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{log.action}</span></TableCell>
                    <TableCell>{log.module}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">{total} registro(s) encontrado(s)</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent></Card>
    </div>
  );
}
