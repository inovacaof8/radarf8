import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-warning mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Erro Inesperado</h1>
        <p className="text-muted-foreground">Ocorreu um erro inesperado. Tente novamente mais tarde.</p>
        <Button asChild><Link to="/dashboard">Voltar ao Dashboard</Link></Button>
      </div>
    </div>
  );
}
