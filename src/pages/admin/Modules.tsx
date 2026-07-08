import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ModulesPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: modules, isLoading } = useQuery({
    queryKey: ["modules-list"],
    queryFn: async () => { const { data } = await supabase.from("modules").select("*").order("created_at"); return data || []; },
  });

  const toggleModule = async (mod: any) => {
    await supabase.from("modules").update({ is_active: !mod.is_active }).eq("id", mod.id);
    await supabase.from("audit_logs").insert({
      user_id: user!.id, user_name: profile?.name || "",
      action: mod.is_active ? "module_deactivated" : "module_activated",
      module: "modules", entity: "module", entity_id: mod.id,
      details: `Módulo ${mod.name} ${mod.is_active ? "desativado" : "ativado"}`,
    });
    toast.success(`Módulo ${mod.is_active ? "desativado" : "ativado"}.`);
    queryClient.invalidateQueries({ queryKey: ["modules-list"] });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Catálogo de Módulos</h1><p className="text-muted-foreground">Gerencie os módulos do sistema</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!modules?.length ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 rounded-full bg-muted mb-4"><Package className="h-8 w-8 text-muted-foreground" /></div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum módulo cadastrado</h3>
            <p className="text-sm text-muted-foreground">Os módulos do sistema aparecerão aqui.</p>
          </div>
        ) : modules.map((mod) => (
          <Card key={mod.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted"><Package className="h-5 w-5 text-primary" /></div>
                  <div><h3 className="font-medium text-foreground">{mod.name}</h3><p className="text-xs text-muted-foreground">{mod.description}</p></div>
                </div>
                <Switch checked={mod.is_active} onCheckedChange={() => toggleModule(mod)} />
              </div>
              <div className="mt-3"><span className={`text-xs px-2 py-0.5 rounded ${mod.is_active ? "status-active" : "status-inactive"}`}>{mod.is_active ? "Ativo" : "Inativo"}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
