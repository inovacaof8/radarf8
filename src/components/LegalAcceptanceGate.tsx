import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
}

export default function LegalAcceptanceGate({ children }: Props) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Get documents that require acceptance
  const { data: pendingDocs, isLoading } = useQuery({
    queryKey: ["pending-legal-acceptances", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all active documents with their latest versions that require acceptance
      const { data: docs } = await supabase
        .from("legal_documents")
        .select("id, title, type")
        .eq("is_active", true);

      if (!docs?.length) return [];

      const pending = [];
      for (const doc of docs) {
        // Get latest version that requires acceptance
        const { data: latestVersion } = await supabase
          .from("legal_document_versions")
          .select("*")
          .eq("document_id", doc.id)
          .eq("requires_acceptance", true)
          .order("version", { ascending: false })
          .limit(1)
          .single();

        if (!latestVersion) continue;

        // Check if user already accepted this version
        const { data: acceptance } = await supabase
          .from("legal_acceptances")
          .select("id")
          .eq("user_id", user.id)
          .eq("version_id", latestVersion.id)
          .limit(1)
          .single();

        if (!acceptance) {
          pending.push({ ...doc, version: latestVersion });
        }
      }
      return pending;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pendingDocs?.length) {
    return <>{children}</>;
  }

  const allChecked = pendingDocs.every((d) => checked[d.id]);

  const handleAcceptAll = async () => {
    if (!user || !allChecked) return;
    setAccepting(true);
    
    for (const doc of pendingDocs) {
      await supabase.from("legal_acceptances").insert({
        user_id: user.id,
        document_id: doc.id,
        version_id: doc.version.id,
      });
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        user_name: profile?.name || user.email || "",
        action: "legal_acceptance",
        module: "legal-documents",
        entity: "legal_document",
        entity_id: doc.id,
        details: `Aceite do documento "${doc.title}" v${doc.version.version}`,
      });
    }
    
    toast.success("Documentos aceitos com sucesso.");
    queryClient.invalidateQueries({ queryKey: ["pending-legal-acceptances"] });
    setAccepting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Documentos Legais Pendentes</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Para continuar utilizando o sistema, é necessário aceitar os documentos abaixo.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {pendingDocs.map((doc) => (
            <div key={doc.id} className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">{doc.title} <span className="text-xs text-muted-foreground font-normal">v{doc.version.version}</span></h3>
              <ScrollArea className="h-40 border rounded p-3 bg-muted/50">
                <div className="text-sm text-foreground whitespace-pre-wrap">{doc.version.content}</div>
              </ScrollArea>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`accept-${doc.id}`}
                  checked={checked[doc.id] || false}
                  onCheckedChange={(v) => setChecked({ ...checked, [doc.id]: !!v })}
                />
                <label htmlFor={`accept-${doc.id}`} className="text-sm">
                  Li e concordo com o documento acima
                </label>
              </div>
            </div>
          ))}
          <Button onClick={handleAcceptAll} disabled={!allChecked || accepting} className="w-full">
            {accepting ? "Processando..." : "Aceitar e Continuar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
