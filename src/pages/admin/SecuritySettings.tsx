import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SecuritySettings() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["security-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("security_settings").select("*").limit(1).single();
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  if (settings && !form) setForm(settings);

  const handleSave = async () => {
    if (!form) return;
    const { id, updated_at, ...rest } = form;
    await supabase.from("security_settings").update(rest).eq("id", id);
    await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "security_settings_updated", module: "security", details: "Configurações de segurança atualizadas" });
    toast.success("Configurações de segurança salvas.");
    queryClient.invalidateQueries({ queryKey: ["security-settings"] });
  };

  if (isLoading || !form) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Configurações de Segurança</h1><p className="text-muted-foreground">Defina as políticas de segurança do sistema</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Política de Senha</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Comprimento mínimo</Label><Input type="number" min={6} max={32} value={form.min_password_length} onChange={(e) => setForm({ ...form, min_password_length: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Histórico de senhas</Label><Input type="number" min={0} value={form.password_history_count} onChange={(e) => setForm({ ...form, password_history_count: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Expiração (dias)</Label><Input type="number" min={0} value={form.password_expiration_days} onChange={(e) => setForm({ ...form, password_expiration_days: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label>Exigir maiúscula</Label><Switch checked={form.require_uppercase} onCheckedChange={(v) => setForm({ ...form, require_uppercase: v })} /></div>
            <div className="flex items-center justify-between"><Label>Exigir minúscula</Label><Switch checked={form.require_lowercase} onCheckedChange={(v) => setForm({ ...form, require_lowercase: v })} /></div>
            <div className="flex items-center justify-between"><Label>Exigir número</Label><Switch checked={form.require_numbers} onCheckedChange={(v) => setForm({ ...form, require_numbers: v })} /></div>
            <div className="flex items-center justify-between"><Label>Exigir caractere especial</Label><Switch checked={form.require_special_chars} onCheckedChange={(v) => setForm({ ...form, require_special_chars: v })} /></div>
            <div className="flex items-center justify-between"><Label>Troca obrigatória no primeiro acesso</Label><Switch checked={form.require_password_change_first_access} onCheckedChange={(v) => setForm({ ...form, require_password_change_first_access: v })} /></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Controle de Acesso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Tentativas máximas</Label><Input type="number" min={3} value={form.max_login_attempts} onChange={(e) => setForm({ ...form, max_login_attempts: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Bloqueio (min)</Label><Input type="number" min={5} value={form.lockout_duration_minutes} onChange={(e) => setForm({ ...form, lockout_duration_minutes: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Timeout sessão (min)</Label><Input type="number" min={5} value={form.session_timeout_minutes} onChange={(e) => setForm({ ...form, session_timeout_minutes: Number(e.target.value) })} /></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label>Múltiplas sessões</Label><Switch checked={form.allow_multiple_sessions} onCheckedChange={(v) => setForm({ ...form, allow_multiple_sessions: v })} /></div>
            <div className="flex items-center justify-between"><div><Label>MFA</Label><p className="text-xs text-muted-foreground">Preparado para implementação futura</p></div><Switch checked={form.mfa_enabled} onCheckedChange={(v) => setForm({ ...form, mfa_enabled: v })} /></div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={handleSave}>Salvar Configurações</Button></div>
    </div>
  );
}
