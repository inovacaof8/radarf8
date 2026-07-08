import {
  LayoutDashboard, Users, Shield, Lock, ShieldCheck, Eye, FileText,
  Settings, Package, Palette, Server, Briefcase, FolderKanban, ListTodo,
  CalendarRange, Files, Map, BarChart3, ChevronDown, CalendarCheck, FolderArchive, Building2, ClipboardList, Bell, UsersRound, Sun, StickyNote, Trophy, GraduationCap, GitBranch, Inbox
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTarefasPendentesHoje } from "@/hooks/useTarefasPendentesHoje";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import f8Logo from "@/assets/f8-logo.png";

// Itens PMO (sempre visíveis para usuários autenticados, RLS filtra dados)
const pmoItems: { title: string; url: string; icon: any; badge?: "tarefas"; module?: string }[] = [
  { title: "Meu Dia", url: "/meu-dia", icon: Sun, badge: "tarefas" },
  { title: "Meu trabalho", url: "/meu-trabalho", icon: ListTodo },
  { title: "Portfólios", url: "/portfolios", icon: Briefcase },
  { title: "Cronogramas", url: "/cronogramas", icon: CalendarRange },
  { title: "Reuniões", url: "/reunioes", icon: CalendarCheck },
  { title: "Planos de Ação", url: "/planos-acao", icon: ClipboardList },
  { title: "Demandas", url: "/demandas", icon: Inbox },
  { title: "PDCA F8", url: "/pdca", icon: Trophy, module: "pdca" },
  { title: "GED", url: "/ged", icon: FolderArchive },
  { title: "Notas", url: "/notas", icon: StickyNote },
  { title: "Roadmap", url: "/roadmap", icon: Map },
  { title: "Notificações", url: "/notificacoes", icon: Bell },
  { title: "Dashboards", url: "/dashboards", icon: BarChart3 },
];

// (Dashboards agora é PMO para todos os usuários — RLS filtra dados)
// Configurações (governança da base) — admin only, agrupadas no rodapé
const configSections = [
  {
    label: "Gestão",
    items: [
      { title: "Usuários", url: "/admin/users", icon: Users, module: "users" },
      { title: "Áreas", url: "/admin/areas", icon: Building2, module: "areas" },
      { title: "Grupos de Notificação", url: "/admin/grupos-notificacao", icon: UsersRound, module: "users" },
      { title: "Perfis", url: "/admin/roles", icon: Shield, module: "roles" },
      { title: "Permissões", url: "/admin/permissions", icon: Lock, module: "permissions" },
    ],
  },
  {
    label: "Conformidade",
    items: [
      { title: "Segurança", url: "/admin/security", icon: ShieldCheck, module: "security" },
      { title: "Privacidade", url: "/admin/privacy", icon: Eye, module: "privacy" },
      { title: "Documentos Legais", url: "/admin/legal", icon: FileText, module: "legal-documents" },
      { title: "Onboarding", url: "/admin/onboarding", icon: GraduationCap, module: "users" },
      { title: "Auditoria", url: "/admin/audit", icon: FileText, module: "audit" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/admin/settings", icon: Settings, module: "settings" },
      { title: "Módulos", url: "/admin/modules", icon: Package, module: "modules" },
      { title: "Workflows", url: "/workflows", icon: GitBranch, module: "workflows" },
      { title: "Visual", url: "/admin/visual", icon: Palette, module: "visual" },
      { title: "Ambiente", url: "/admin/environment", icon: Server, module: "environment" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, hasPermission } = useAuth();
  const { data: tarefasPendentes = 0 } = useTarefasPendentesHoje();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col">
        {/* Logo F8 */}
        <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-3">
          <img src={f8Logo} alt="Grupo F8" className="h-10 w-10 rounded-2xl shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-sidebar-foreground leading-tight">Radar F8</h2>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Grupo F8</p>
            </div>
          )}
        </div>

        {/* PMO */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>PMO</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {pmoItems
                .filter((item) => !item.module || isAdmin || hasPermission(item.module, "view"))
                .map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/meu-trabalho"}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-brand-500 text-ink font-semibold hover:bg-brand-500 hover:text-ink"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && (item as any).badge === "tarefas" && tarefasPendentes > 0 && (
                        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">{tarefasPendentes}</Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações (admin only, no rodapé) */}
        {isAdmin && (
          <div className="mt-auto border-t border-sidebar-border pt-2">
            <Collapsible defaultOpen={false}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wider text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <span className="flex items-center gap-2">
                      <Settings className="h-3.5 w-3.5" />
                      {!collapsed && <span>Configurações</span>}
                    </span>
                    {!collapsed && <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {configSections.map((section) => {
                    const visible = section.items.filter((i) => hasPermission(i.module, "view"));
                    if (!visible.length) return null;
                    return (
                      <SidebarGroup key={section.label} className="py-1">
                        {!collapsed && (
                          <SidebarGroupLabel className="text-[10px]">{section.label}</SidebarGroupLabel>
                        )}
                        <SidebarGroupContent>
                          <SidebarMenu>
                            {visible.map((item) => (
                              <SidebarMenuItem key={item.url}>
                                <SidebarMenuButton asChild size="sm">
                                  <NavLink
                                    to={item.url}
                                    className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    activeClassName="bg-brand-500 text-ink font-semibold hover:bg-brand-500 hover:text-ink"
                                  >
                                    <item.icon className="mr-2 h-4 w-4 shrink-0" />
                                    {!collapsed && <span>{item.title}</span>}
                                  </NavLink>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </SidebarGroupContent>
                      </SidebarGroup>
                    );
                  })}
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
