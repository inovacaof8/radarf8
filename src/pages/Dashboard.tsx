import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, UserCheck, UserX, ShieldAlert, Shield, Clock,
  AlertTriangle, FileText, Package, Activity, Loader2, CheckCircle, XCircle
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: profiles } = useQuery({
    queryKey: ["profiles-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("status");
      return data || [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("is_active");
      return data || [];
    },
  });

  const { data: modules } = useQuery({
    queryKey: ["modules-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("is_active");
      return data || [];
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["recent-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: legalDocs } = useQuery({
    queryKey: ["legal-docs-compliance"],
    queryFn: async () => {
      const { data } = await supabase.from("legal_documents").select("id, title, type, is_active");
      return data || [];
    },
  });

  const { data: legalVersions } = useQuery({
    queryKey: ["legal-versions-compliance"],
    queryFn: async () => {
      const { data } = await supabase.from("legal_document_versions").select("document_id, version, requires_acceptance").order("version", { ascending: false });
      return data || [];
    },
  });

  if (!profiles) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalUsers = profiles.length;
  const activeUsers = profiles.filter((u) => u.status === "active").length;
  const inactiveUsers = profiles.filter((u) => u.status === "inactive").length;
  const blockedUsers = profiles.filter((u) => u.status === "blocked").length;
  const activeRoles = roles?.filter((r) => r.is_active).length || 0;
  const activeModules = modules?.filter((m) => m.is_active).length || 0;
  const totalModules = modules?.length || 0;
  const failedLogins = recentLogs?.filter((l) => l.action === "login_failed").length || 0;

  const stats = [
    { label: "Total de Usuários", value: totalUsers, icon: Users, color: "text-primary" },
    { label: "Usuários Ativos", value: activeUsers, icon: UserCheck, color: "text-success" },
    { label: "Usuários Inativos", value: inactiveUsers, icon: UserX, color: "text-muted-foreground" },
    { label: "Usuários Bloqueados", value: blockedUsers, icon: ShieldAlert, color: "text-destructive" },
    { label: "Perfis Ativos", value: activeRoles, icon: Shield, color: "text-primary" },
    { label: "Módulos Ativos", value: `${activeModules}/${totalModules}`, icon: Package, color: "text-primary" },
  ];

  const alerts: { text: string; icon: React.ElementType }[] = [];
  if (blockedUsers > 0) alerts.push({ text: `${blockedUsers} usuário(s) bloqueado(s)`, icon: ShieldAlert });
  if (failedLogins > 0) alerts.push({ text: `${failedLogins} tentativa(s) de acesso inválida(s) recentes`, icon: AlertTriangle });

  // Compliance checks
  const activeDocs = legalDocs?.filter(d => d.is_active) || [];
  const docsWithVersions = activeDocs.map(doc => {
    const versions = legalVersions?.filter(v => v.document_id === doc.id) || [];
    return { ...doc, hasVersion: versions.length > 0, latestRequiresAcceptance: versions[0]?.requires_acceptance };
  });
  const docsWithoutVersions = docsWithVersions.filter(d => !d.hasVersion);
  if (docsWithoutVersions.length > 0) alerts.push({ text: `${docsWithoutVersions.length} documento(s) legal(is) sem versão publicada`, icon: FileText });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do ambiente</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`p-3 rounded-lg bg-muted ${stat.color}`}><stat.icon className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted">
                <alert.icon className="h-4 w-4 text-destructive shrink-0" /><span>{alert.text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Atividade Recente</CardTitle></CardHeader>
        <CardContent>
          {!recentLogs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded hover:bg-muted/50">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">
                      <span className="font-medium">{log.user_name}</span> — <span>{log.action}</span>
                      {log.details && <span className="text-muted-foreground"> · {log.details}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
