import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const BUCKET = "workflow-demand-attachments";

export function DemandAttachments({
  demandId,
  createdBy,
}: {
  demandId: string;
  createdBy: string;
}) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const canUpload = user?.id === createdBy;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["wf_demand_attachments", demandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_demand_attachment")
        .select("*")
        .eq("demand_id", demandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${demandId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("workflow_demand_attachment").insert({
        demand_id: demandId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      } as any);
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Anexo enviado");
      qc.invalidateQueries({ queryKey: ["wf_demand_attachments", demandId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: any) => {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
      const { error } = await supabase.from("workflow_demand_attachment").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anexo removido");
      qc.invalidateQueries({ queryKey: ["wf_demand_attachments", demandId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" /> Anexos {items.length > 0 && `(${items.length})`}
        </div>
        {canUpload && (
          <>
            <input
              type="file"
              ref={fileRef}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {upload.isPending ? "Enviando..." : "Anexar"}
            </Button>
          </>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 p-2 text-sm">
              <button className="flex-1 text-left hover:underline truncate" onClick={() => openFile(it.storage_path)}>
                {it.file_name}
              </button>
              <span className="text-xs text-muted-foreground">
                {it.size_bytes ? `${Math.round(it.size_bytes / 1024)} KB` : ""}
              </span>
              <Button size="icon" variant="ghost" onClick={() => openFile(it.storage_path)}>
                <Download className="h-4 w-4" />
              </Button>
              {(isAdmin || user?.id === it.uploaded_by) && (
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(it)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
