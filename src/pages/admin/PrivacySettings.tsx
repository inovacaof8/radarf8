import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PrivacySettings() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["privacy-settings"],
    queryFn: async () => { const { data } = await supabase.from("privacy_settings").select("*").limit(1).single(); return data; },
  });

  const [form, setForm] = useState<any>(null);
  if (settings && !form) setForm(settings);

  const handleSave = async () => {
    if (!form) return;
    const { id, updated_at, ...rest } = form;
    await supabase.from("privacy_settings").update(rest).eq("id", id);
    await supabase.from("audit_logs").insert({ user_id: user!.id, user_name: profile?.name || "", action: "privacy_settings_updated", module: "privacy", details: "Configurações de privacidade atualizadas" });
    toast.success("Configurações de privacidade salvas.");
    queryClient.invalidateQueries({ queryKey: ["privacy-settings"] });
  };

  const addCategory = () => {
    if (newCategory.trim() && form && !form.data_categories?.includes(newCategory.trim())) {
      setForm({ ...form, data_categories: [...(form.data_categories || []), newCategory.trim()] });
      setNewCategory("");
    }
  };

  const removeCategory = (cat: string) => {
    if (form) setForm({ ...form, data_categories: form.data_categories?.filter((c: string) => c !== cat) });
  };

  if (isLoading || !form) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Configurações de Privacidade</h1><p className="text-muted-foreground">Gerencie as políticas de privacidade e proteção de dados</p></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Configurações Gerais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Retenção (dias)</Label><Input type="number" value={form.retention_days} onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label>E-mail DPO</Label><Input value={form.dpo_email || ""} onChange={(e) => setForm({ ...form, dpo_email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nome DPO</Label><Input value={form.dpo_name || ""} onChange={(e) => setForm({ ...form, dpo_name: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between"><Label>Banner de cookies</Label><Switch checked={form.show_cookie_banner} onCheckedChange={(v) => setForm({ ...form, show_cookie_banner: v })} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Categorias de Dados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">{form.data_categories?.map((cat: string) => <Badge key={cat} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeCategory(cat)}>{cat} ×</Badge>)}</div>
          <div className="flex gap-2"><Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nova categoria..." onKeyDown={(e) => e.key === "Enter" && addCategory()} /><Button variant="outline" onClick={addCategory}>Adicionar</Button></div>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Direitos do Titular</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Estrutura preparada para futura gestão de solicitações do titular.</p></CardContent></Card>
      <div className="flex justify-end"><Button onClick={handleSave}>Salvar Configurações</Button></div>
    </div>
  );
}
