import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  profile: "Meu Perfil",
  admin: "Administração",
  users: "Usuários",
  roles: "Perfis",
  permissions: "Permissões",
  audit: "Auditoria",
  security: "Segurança",
  privacy: "Privacidade",
  settings: "Configurações",
  legal: "Documentos Legais",
  modules: "Módulos",
  visual: "Visual",
  environment: "Ambiente",
};

const isId = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
  /^\d+$/.test(s);

export default function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean).filter((s) => !isId(s));

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <Link to="/dashboard" className="hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" />
          {crumb.isLast ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
