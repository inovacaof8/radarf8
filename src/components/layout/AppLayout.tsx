import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Loader2 } from "lucide-react";
import { Outlet, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LegalAcceptanceGate from "@/components/LegalAcceptanceGate";
import OnboardingGate from "@/components/OnboardingGate";
import Breadcrumb from "@/components/layout/Breadcrumb";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalFab } from "@/components/fab/GlobalFab";

export default function AppLayout() {
  const { profile, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  useDynamicTheme();

  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*").limit(1).single();
      return data;
    },
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.must_change_password && window.location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  const settings = systemSettings;
  const appName = settings?.app_short_name || settings?.app_name || "Radar F8";
  const env = (settings?.environment || "development") as string;
  const version = settings?.version || "1.0.0";
  const footer = settings?.footer_text || "";

  const envLabel: Record<string, string> = { development: "Desenvolvimento", staging: "Homologação", production: "Produção" };
  

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {env !== "production" && (
            <div
              className="text-center text-xs py-1 font-medium"
              style={{
                backgroundColor: env === "staging"
                  ? (settings?.primary_color ? settings.primary_color + "CC" : "hsl(38, 92%, 50%)")
                  : (settings?.primary_color || "hsl(215, 70%, 45%)"),
                color: env === "staging" ? "hsl(0, 0%, 10%)" : "hsl(0, 0%, 100%)",
              }}
            >
              Ambiente: {envLabel[env] || env} — v{version}
            </div>
          )}
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-semibold text-foreground">{appName}</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{profile?.name}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <LegalAcceptanceGate>
              <OnboardingGate>
                <Breadcrumb />
                <Outlet />
              </OnboardingGate>
            </LegalAcceptanceGate>
          </main>
          {footer && (
            <footer className="text-xs text-muted-foreground text-center py-3 border-t bg-card">
              {footer}
            </footer>
          )}
          <GlobalFab />
        </div>
      </div>
    </SidebarProvider>
  );
}
