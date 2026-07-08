import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Replace, CopyX, XCircle } from "lucide-react";

export type DuplicateDoc = {
  id: string;
  titulo: string;
  tipo_documento: string;
  numero_documento: string | null;
  status: string;
  instituicao?: { name: string } | null;
  parceiro?: { name: string } | null;
};

export function useCheckDuplicate(
  titulo: string,
  tipo: string,
  instId: string,
  numero: string | null | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["ged_duplicate_check", titulo, tipo, instId, numero],
    enabled: enabled && !!titulo.trim() && !!tipo && !!instId,
    queryFn: async () => {
      const num = (numero ?? "").trim() || null;
      let q = (supabase as any)
        .from("ged_document")
        .select("id,titulo,tipo_documento,numero_documento,status,instituicao:ged_institution(name),parceiro:ged_partner(name)")
        .ilike("titulo", titulo.trim())
        .eq("tipo_documento", tipo)
        .eq("instituicao_id", instId);

      if (num) {
        q = q.eq("numero_documento", num);
      } else {
        q = q.or("numero_documento.is.null,numero_documento.eq.\"\"");
      }

      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data ?? null) as DuplicateDoc | null;
    },
  });
}

type DuplicateCheckDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: DuplicateDoc | null;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
};

export function DuplicateCheckDialog({
  open, onOpenChange, existing, onReplace, onKeepBoth, onCancel,
}: DuplicateCheckDialogProps) {
  if (!existing) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Documento já existe
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Já existe um documento cadastrado com os mesmos dados:</p>
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <p><span className="font-medium">Título:</span> {existing.titulo}</p>
            <p><span className="font-medium">Tipo:</span> {existing.tipo_documento}</p>
            {existing.numero_documento && (
              <p><span className="font-medium">Número:</span> {existing.numero_documento}</p>
            )}
            <p><span className="font-medium">Instituição:</span> {existing.instituicao?.name ?? "—"}</p>
            <p><span className="font-medium">Status:</span> {existing.status}</p>
          </div>
          <p className="text-muted-foreground">O que deseja fazer?</p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onCancel} className="sm:order-1">
            <XCircle className="h-4 w-4 mr-2" /> Cancelar
          </Button>
          <Button variant="outline" onClick={onKeepBoth} className="sm:order-2">
            <CopyX className="h-4 w-4 mr-2" /> Manter ambos
          </Button>
          <Button onClick={onReplace} className="sm:order-3">
            <Replace className="h-4 w-4 mr-2" /> Substituir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
