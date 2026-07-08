import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useOnboardingRequired } from "@/hooks/useOnboarding";

interface Props {
  children: React.ReactNode;
}

export default function OnboardingGate({ children }: Props) {
  const required = useOnboardingRequired();
  const loc = useLocation();
  // Permite acessar a própria página do onboarding e a saída de logout/perfil mínima.
  const allowed = loc.pathname.startsWith("/onboarding") || loc.pathname === "/profile";
  if (required && !allowed) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
