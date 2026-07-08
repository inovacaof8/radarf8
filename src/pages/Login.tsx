import { useState, useEffect } from "react";
import { useNavigate, Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";
import radarLogo from "@/assets/radar-f8-logo.png.asset.json";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeSettings = useDynamicTheme();
  const appName = themeSettings?.app_short_name || themeSettings?.app_name || "Radar F8";

  useEffect(() => {
    if (searchParams.get("error") === "no_profile") {
      setError("Seu e-mail não possui cadastro no sistema. Solicite acesso a um administrador.");
    }
  }, [searchParams]);

  if (isAuthenticated) return <Navigate to="/meu-trabalho" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate(result.mustChangePassword ? "/change-password" : "/meu-trabalho", { replace: true });
    } else {
      setError(result.error || "Erro ao autenticar.");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      {/* Left Panel — Brand (LIGHT, exact logo background color) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative flex-col items-center justify-center bg-[#ffffff]">
        <div className="relative z-10 flex flex-col items-center px-12">
          <img src={radarLogo.url} alt={appName} className="w-[28rem] max-w-full h-auto mb-6" />
          <p className="mt-2 text-base text-neutral-600 text-center max-w-md leading-relaxed">
            Plataforma de governança, monitoramento e gestão integrada.
          </p>
        </div>
      </div>

      {/* Right Panel — Form (DARK) */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-neutral-950">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8 bg-white rounded-xl p-4">
            <img src={radarLogo.url} alt={appName} className="w-56 h-auto" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Bem-vindo de volta</h1>
            <p className="mt-1.5 text-sm text-neutral-400">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="text-xs">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-neutral-200">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                autoComplete="email"
                className="h-11 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus-visible:ring-[#FFD500]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-neutral-200">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="h-11 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-500 focus-visible:ring-[#FFD500]"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold bg-[#FFD500] hover:bg-[#e6c000] text-neutral-950 transition-colors"
              disabled={loading || googleLoading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <div className="relative my-4">
              <Separator className="bg-neutral-800" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-neutral-950 px-3 text-xs text-neutral-500 font-medium">
                ou
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 font-medium bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800 hover:text-white transition-colors"
              disabled={loading || googleLoading}
              onClick={async () => {
                setGoogleLoading(true);
                setError("");
                try {
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) setError("Erro ao autenticar com Google.");
                  if (result.redirected) return;
                } catch {
                  setError("Erro ao autenticar com Google.");
                }
                setGoogleLoading(false);
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? "Conectando..." : "Continuar com Google"}
            </Button>

            <div className="text-center pt-2">
              <Link to="/forgot-password" className="text-sm text-[#FFD500] hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>
          </form>

          <div className="mt-8 text-center text-xs text-neutral-500 space-x-3">
            <Link to="/privacy" className="hover:text-neutral-300 hover:underline">
              Privacidade
            </Link>
            <Link to="/terms" className="hover:text-neutral-300 hover:underline">
              Termos
            </Link>
            <Link to="/cookies" className="hover:text-neutral-300 hover:underline">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
