import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VisualSettings() {
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
    await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "visual_settings_updated", module: "visual", details: "Identidade visual atualizada" });
    toast.success("Identidade visual salva.");
    queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    queryClient.invalidateQueries({ queryKey: ["system-settings-theme"] });
  };

  if (isLoading || !form) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Parametrização Visual</h1><p className="text-muted-foreground">Configure a identidade visual</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Identidade Visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nome Completo</Label><Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nome Curto</Label><Input value={form.app_short_name} onChange={(e) => setForm({ ...form, app_short_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cor Primária</Label><div className="flex gap-2"><Input type="color" value={form.primary_color || "#2563EB"} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-12 h-10 p-1" /><Input value={form.primary_color || ""} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div></div>
            <div className="space-y-2"><Label>Cor Secundária</Label><div className="flex gap-2"><Input type="color" value={form.secondary_color || "#64748B"} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-12 h-10 p-1" /><Input value={form.secondary_color || ""} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></div></div>
            <div className="space-y-2"><Label>Cor de Fundo</Label><div className="flex gap-2"><Input type="color" value={form.background_color || "#F5F7FA"} onChange={(e) => setForm({ ...form, background_color: e.target.value })} className="w-12 h-10 p-1" /><Input value={form.background_color || ""} onChange={(e) => setForm({ ...form, background_color: e.target.value })} /></div></div>
            <div className="space-y-2"><Label>URL Logotipo</Label><Input value={form.logo_url || ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>URL Favicon</Label><Input value={form.favicon_url || ""} onChange={(e) => setForm({ ...form, favicon_url: e.target.value })} placeholder="https://..." /></div>
          </div>
          <div className="mt-4 p-4 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: form.primary_color || "#2563EB" }}>
                {(form.app_short_name || "GB").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: form.primary_color || "#2563EB" }}>{form.app_short_name || "GovBase"}</p>
                <p className="text-xs text-muted-foreground">{form.app_name}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={handleSave}>Salvar</Button></div>
    </div>
  );
}
