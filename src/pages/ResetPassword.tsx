import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  const { data: secSettings } = useQuery({
    queryKey: ["security-settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("security_settings").select("*").limit(1).single();
      return data;
    },
  });

  useEffect(() => {
    // Check if this is a recovery flow
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }
    
    if (secSettings) {
      if (newPassword.length < secSettings.min_password_length)
        { setError(`A senha deve ter no mínimo ${secSettings.min_password_length} caracteres.`); return; }
      if (secSettings.require_uppercase && !/[A-Z]/.test(newPassword))
        { setError("A senha deve conter ao menos uma letra maiúscula."); return; }
      if (secSettings.require_lowercase && !/[a-z]/.test(newPassword))
        { setError("A senha deve conter ao menos uma letra minúscula."); return; }
      if (secSettings.require_numbers && !/\d/.test(newPassword))
        { setError("A senha deve conter ao menos um número."); return; }
      if (secSettings.require_special_chars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword))
        { setError("A senha deve conter ao menos um caractere especial."); return; }
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    
    if (updateError) {
      setError("Erro ao redefinir a senha. Tente novamente.");
      return;
    }
    
    navigate("/dashboard", { replace: true });
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Link inválido ou expirado. Solicite uma nova recuperação de senha.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Redefinir Senha</CardTitle>
          <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {secSettings && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>A senha deve conter:</p>
                <ul className="list-disc pl-4">
                  <li>Mínimo de {secSettings.min_password_length} caracteres</li>
                  {secSettings.require_uppercase && <li>Ao menos uma letra maiúscula</li>}
                  {secSettings.require_lowercase && <li>Ao menos uma letra minúscula</li>}
                  {secSettings.require_numbers && <li>Ao menos um número</li>}
                  {secSettings.require_special_chars && <li>Ao menos um caractere especial</li>}
                </ul>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Redefinindo..." : "Redefinir Senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
