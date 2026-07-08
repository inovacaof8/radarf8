import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GeneralSettings() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => { const { data } = await supabase.from("system_settings").select("*").limit(1).single(); return data; },
  });

  const [form, setForm] = useState<any>(null);
  if (settings && !form) setForm(settings);

  const handleSave = async () => {
    if (!form) return;
    const { id, updated_at, ...rest } = form;
    await supabase.from("system_settings").update(rest).eq("id", id);
    await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "system_settings_updated", module: "settings", details: "Configurações gerais atualizadas" });
    toast.success("Configurações salvas.");
    queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    queryClient.invalidateQueries({ queryKey: ["system-settings-theme"] });
  };

  if (isLoading || !form) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Configurações Gerais</h1><p className="text-muted-foreground">Parametrizações gerais do sistema</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Identidade da Aplicação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nome Curto</Label><Input value={form.app_short_name} onChange={(e) => setForm({ ...form, app_short_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail de Contato</Label><Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Versão</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
            <div className="space-y-2"><Label>Idioma</Label><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="development">Desenvolvimento</SelectItem><SelectItem value="staging">Homologação</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.app_description || ""} onChange={(e) => setForm({ ...form, app_description: e.target.value })} rows={3} /></div>
          <div className="space-y-2"><Label>Rodapé</Label><Input value={form.footer_text || ""} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={handleSave}>Salvar Configurações</Button></div>
    </div>
  );
}
