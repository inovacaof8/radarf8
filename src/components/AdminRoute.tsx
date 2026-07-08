import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !isAdmin) toast.error("Acesso restrito");
  }, [isLoading, isAdmin]);
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/meu-trabalho" replace />;
  return <>{children}</>;
}
