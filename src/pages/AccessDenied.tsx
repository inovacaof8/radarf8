import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <ShieldOff className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não possui permissão para acessar esta página.</p>
        <Button asChild><Link to="/dashboard">Voltar ao Dashboard</Link></Button>
      </div>
    </div>
  );
}
