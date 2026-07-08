import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Calendar, Hash, Shield, Eye, Package, Loader2 } from "lucide-react";

export default function EnvironmentInfo() {
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => { const { data } = await supabase.from("system_settings").select("*").limit(1).single(); return data; },
  });
  const { data: modules } = useQuery({
    queryKey: ["modules-stats"],
    queryFn: async () => { const { data } = await supabase.from("modules").select("is_active"); return data || []; },
  });
  const { data: secSettings } = useQuery({
    queryKey: ["security-settings"],
    queryFn: async () => { const { data } = await supabase.from("security_settings").select("mfa_enabled").limit(1).single(); return data; },
  });

  if (loadingSettings) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const s = settings;
  const envLabels: Record<string, string> = { development: "Desenvolvimento", staging: "Homologação", production: "Produção" };
  const activeModules = modules?.filter((m) => m.is_active).length || 0;
  const totalModules = modules?.length || 0;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Governança de Ambiente</h1><p className="text-muted-foreground">Informações do ambiente e status do sistema</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Server className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Ambiente</p><p className="text-lg font-bold">{envLabels[s?.environment || "development"]}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Hash className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Versão</p><p className="text-lg font-bold">{s?.version}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Calendar className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Atualização</p><p className="text-lg font-bold">{s?.updated_at ? new Date(s.updated_at).toLocaleDateString("pt-BR") : "-"}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Package className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Módulos</p><p className="text-lg font-bold">{activeModules}/{totalModules}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Shield className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Segurança</p><p className="text-lg font-bold">{secSettings?.mfa_enabled ? "MFA Ativo" : "Configurada"}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><div className="p-3 rounded-lg bg-muted text-primary"><Eye className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Privacidade</p><p className="text-lg font-bold">Configurada</p></div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Detalhes</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{s?.app_name}</dd></div>
            <div><dt className="text-muted-foreground">Contato</dt><dd className="font-medium">{s?.contact_email}</dd></div>
            <div><dt className="text-muted-foreground">Idioma</dt><dd className="font-medium">{s?.language}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
