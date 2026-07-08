import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, Clock, Calendar, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export default function UserProfile() {
  const { user, profile, roles } = useAuth();
  const [exporting, setExporting] = useState(false);

  if (!user || !profile) return null;

  const handleExportMyData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "export_user_data", userId: user.id },
      });
      if (error || data?.error) {
        toast.error("Erro ao exportar dados.");
        return;
      }
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus_dados_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Seus dados foram exportados.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1><p className="text-muted-foreground">Informações da sua conta</p></div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Nome</p><p className="font-medium">{profile.name}</p></div></div>
          <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">E-mail</p><p className="font-medium">{user.email}</p></div></div>
          <div className="flex items-center gap-3"><Shield className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Perfis</p><p className="font-medium">{roles.length > 0 ? roles.map((r) => r.name).join(", ") : "—"}</p></div></div>
          <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Último Acesso</p><p className="font-medium">{profile.last_access ? new Date(profile.last_access).toLocaleString("pt-BR") : "Primeiro acesso"}</p></div></div>
          <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Criado em</p><p className="font-medium">{new Date(profile.created_at).toLocaleDateString("pt-BR")}</p></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Privacidade e Dados (LGPD)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Conforme a Lei Geral de Proteção de Dados (LGPD), você tem o direito de exportar todos os seus dados pessoais armazenados nesta plataforma.
          </p>
          <Button variant="outline" onClick={handleExportMyData} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar Meus Dados"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
