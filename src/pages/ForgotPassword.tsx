import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Always show success to prevent user enumeration
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <KeyRound className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Recuperação de Senha</CardTitle>
          <CardDescription>Informe seu e-mail para receber instruções</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Se o e-mail informado estiver cadastrado, você receberá instruções para redefinir sua senha.
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Enviando..." : "Enviar instruções"}</Button>
            </form>
          )}
          <div className="text-center mt-4">
            <Link to="/login" className="text-sm text-primary hover:underline">Voltar ao login</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
