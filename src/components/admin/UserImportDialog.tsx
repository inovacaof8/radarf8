import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";

interface ImportRow {
  name: string;
  email: string;
  role: string;
  notes: string;
}

interface ImportResult {
  row: number;
  email: string;
  status: string;
  tempPassword?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserImportDialog({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "results">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const reset = () => {
    setStep("upload");
    setRows([]);
    setErrors([]);
    setResults([]);
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome", "email", "perfil", "observacoes"],
      ["João da Silva", "joao@empresa.com", "Operador", "Departamento TI"],
      ["Maria Santos", "maria@empresa.com", "Gestor; PMO", "Pode ter mais de um perfil separado por ; ou ,"],
    ]);
    ws["!cols"] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
    XLSX.writeFile(wb, "modelo_importacao_usuarios.xlsx");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrors(["Formato inválido. Use .xlsx, .xls ou .csv"]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (data.length === 0) {
          setErrors(["Planilha vazia."]);
          return;
        }

        const validationErrors: string[] = [];
        const parsed: ImportRow[] = [];
        const emails = new Set<string>();

        for (let i = 0; i < data.length; i++) {
          const r = data[i];
          const name = (r["nome"] || r["Nome"] || r["name"] || r["Name"] || "").trim();
          const email = (r["email"] || r["Email"] || r["e-mail"] || r["E-mail"] || "").trim().toLowerCase();
          const role = (r["perfil"] || r["Perfil"] || r["role"] || r["Role"] || "").trim();
          const notes = (r["observacoes"] || r["observações"] || r["Observações"] || r["notes"] || r["Notes"] || "").trim();

          if (!name) validationErrors.push(`Linha ${i + 2}: Nome é obrigatório`);
          if (!email) validationErrors.push(`Linha ${i + 2}: E-mail é obrigatório`);
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validationErrors.push(`Linha ${i + 2}: E-mail inválido (${email})`);
          else if (emails.has(email)) validationErrors.push(`Linha ${i + 2}: E-mail duplicado (${email})`);
          else emails.add(email);

          parsed.push({ name, email, role, notes });
        }

        if (validationErrors.length > 0) {
          setErrors(validationErrors);
          setRows(parsed);
          setStep("preview");
          return;
        }

        setErrors([]);
        setRows(parsed);
        setStep("preview");
      } catch {
        setErrors(["Erro ao ler o arquivo. Verifique o formato."]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (rows.length === 0 || errors.length > 0) return;
    setImporting(true);

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "bulk_create",
        users: rows.map((r) => ({ name: r.name, email: r.email, role: r.role, notes: r.notes })),
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Erro na importação.");
      setImporting(false);
      return;
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      user_name: profile?.name || "",
      action: "users_bulk_imported",
      module: "users",
      entity: "user",
      details: `Importação em lote: ${data.results.filter((r: ImportResult) => r.status === "success").length} criados, ${data.results.filter((r: ImportResult) => r.status === "error").length} erros`,
    });

    setResults(data.results);
    setStep("results");
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const exportResults = () => {
    const wsData = [
      ["Linha", "E-mail", "Status", "Senha Temporária", "Erro"],
      ...results.map((r) => [r.row, r.email, r.status === "success" ? "Criado" : "Erro", r.tempPassword || "", r.error || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultado");
    XLSX.writeFile(wb, "resultado_importacao_usuarios.xlsx");
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Usuários via Planilha
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Importe múltiplos usuários a partir de uma planilha Excel ou CSV.</p>
        </DialogHeader>

        {step === "upload" && (
          <ScrollArea className="flex-1 overflow-auto">
          <div className="space-y-6 py-4">
            <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center space-y-4">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Selecione um arquivo .xlsx, .xls ou .csv</p>
                <p className="text-xs text-muted-foreground mt-1">Máximo de 200 usuários por importação</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Selecionar Arquivo
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Padrão do Arquivo</h4>
              <p className="text-xs text-muted-foreground">A planilha deve conter as seguintes colunas na primeira linha:</p>
              <div className="overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coluna</TableHead>
                      <TableHead className="text-xs">Obrigatório</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="text-xs font-mono">nome</TableCell><TableCell><Badge variant="destructive" className="text-[10px]">Sim</Badge></TableCell><TableCell className="text-xs text-muted-foreground">Nome completo do usuário</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-mono">email</TableCell><TableCell><Badge variant="destructive" className="text-[10px]">Sim</Badge></TableCell><TableCell className="text-xs text-muted-foreground">E-mail corporativo (login)</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-mono">perfil</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">Não</Badge></TableCell><TableCell className="text-xs text-muted-foreground">Um ou mais perfis (ex: "Gestor; PMO"). Separadores aceitos: ; , | /</TableCell></TableRow>
                    <TableRow><TableCell className="text-xs font-mono">observacoes</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">Não</Badge></TableCell><TableCell className="text-xs text-muted-foreground">Notas/observações sobre o usuário</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="ghost" size="sm" className="gap-2 text-xs" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Baixar Modelo
              </Button>
            </div>
          </div>
          </ScrollArea>
        )}

        {step === "preview" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">{errors.length} erro(s) encontrado(s):</p>
                  <ul className="list-disc pl-4 text-xs space-y-0.5 max-h-24 overflow-auto">
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-muted-foreground">{rows.length} usuário(s) encontrado(s) na planilha.</p>
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">E-mail</TableHead>
                    <TableHead className="text-xs">Perfil</TableHead>
                    <TableHead className="text-xs">Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 2}</TableCell>
                      <TableCell className="text-xs">{r.name || <span className="text-destructive">vazio</span>}</TableCell>
                      <TableCell className="text-xs">{r.email || <span className="text-destructive">vazio</span>}</TableCell>
                      <TableCell className="text-xs">{r.role || "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[150px]">{r.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing || errors.length > 0} className="gap-2">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : `Importar ${rows.length} Usuário(s)`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-3">
              {successCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-foreground font-medium">{successCount} criado(s)</span>
                </div>
              )}
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-foreground font-medium">{errorCount} erro(s)</span>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Linha</TableHead>
                    <TableHead className="text-xs">E-mail</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Senha Temporária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.row}</TableCell>
                      <TableCell className="text-xs">{r.email}</TableCell>
                      <TableCell>
                        {r.status === "success" ? (
                          <Badge className="bg-primary/10 text-primary text-[10px]">Criado</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">{r.error}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.tempPassword ? (
                          <span className="flex items-center gap-1">
                            <code className="font-mono text-[11px]">{r.tempPassword}</code>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { navigator.clipboard.writeText(r.tempPassword!); toast.success("Copiado!"); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Exporte o resultado para obter todas as senhas temporárias. Os usuários serão obrigados a trocar a senha no primeiro acesso.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={exportResults} className="gap-2">
                <Download className="h-4 w-4" /> Exportar Resultado
              </Button>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}

        {step === "upload" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
