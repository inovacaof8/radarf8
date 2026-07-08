import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { changePassword, profile } = useAuth();
  const navigate = useNavigate();

  const { data: secSettings } = useQuery({
    queryKey: ["public-security-settings"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_security_settings");
      return data as any;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    const result = await changePassword(newPassword);
    setLoading(false);
    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error || "Erro ao alterar senha.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Alterar Senha</CardTitle>
          <CardDescription>
            {profile?.must_change_password ? "É necessário alterar sua senha antes de continuar." : "Defina uma nova senha para sua conta."}
          </CardDescription>
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
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Alterando..." : "Alterar Senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
