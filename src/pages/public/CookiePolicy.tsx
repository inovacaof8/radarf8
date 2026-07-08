import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  const { data } = useQuery({
    queryKey: ["public-cookies"],
    queryFn: async () => {
      const { data: doc } = await supabase.from("legal_documents").select("id").eq("type", "cookies").single();
      if (!doc) return null;
      const { data: ver } = await supabase.from("legal_document_versions").select("*").eq("document_id", doc.id).order("version", { ascending: false }).limit(1).single();
      return ver;
    },
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        <h1 className="text-2xl font-bold text-foreground mb-2">Política de Cookies</h1>
        {data && <p className="text-xs text-muted-foreground mb-6">Versão {data.version} — {new Date(data.published_at).toLocaleDateString("pt-BR")}</p>}
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{data?.content || "Documento não disponível."}</div>
      </div>
    </div>
  );
}
