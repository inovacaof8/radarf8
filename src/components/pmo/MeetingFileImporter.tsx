import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  onExtracted: (text: string, fileName: string) => void;
  disabled?: boolean;
};

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function MeetingFileImporter({ onExtracted, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo maior que 15MB.");
      return;
    }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      // Converte ArrayBuffer -> base64 sem estourar memória em arquivos médios
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
        );
      }
      const file_b64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("import-meeting-document", {
        body: { file_name: file.name, mime_type: file.type, file_b64 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const text = (data as any)?.extracted_text as string;
      if (!text) throw new Error("Sem texto extraído.");
      onExtracted(text, file.name);
      toast.success(`Texto extraído (${text.length.toLocaleString("pt-BR")} caracteres).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar o arquivo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lendo arquivo…
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Importar ata (DOCX ou PDF)
          </>
        )}
      </Button>
    </div>
  );
}
