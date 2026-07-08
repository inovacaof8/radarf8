import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  status: string;
  must_change_password: boolean;
  login_attempts: number;
  locked_until: string | null;
  last_access: string | null;
  notes: string | null;
  created_at: string;
}

interface RoleInfo {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Primeiro perfil atribuído (compatibilidade). Para múltiplos perfis use `roles`. */
  role: RoleInfo | null;
  /** Todos os perfis atribuídos ao usuário. */
  roles: RoleInfo[];
  permissions: { module: string; action: string }[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (module: string, action: string) => boolean;
  /** Retorna true se o usuário possuir qualquer um dos perfis informados. */
  hasAnyRole: (...names: string[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [permissions, setPermissions] = useState<{ module: string; action: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimeoutRef = useRef<number>(30); // default 30 min

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (profileData) setProfile(profileData as Profile);

      // Carrega TODOS os perfis atribuídos ao usuário (multi-perfil).
      const { data: userRolesData } = await supabase
        .from("user_roles")
        .select("role_id, roles(id, name)")
        .eq("user_id", userId);
      const loadedRoles: RoleInfo[] = (userRolesData || [])
        .map((row: any) => row.roles as RoleInfo | null)
        .filter((r): r is RoleInfo => !!r);
      setRoles(loadedRoles);

      // Permissões são a união das permissões de todos os perfis (já resolvido na função).
      const { data: permsData } = await supabase.rpc("get_user_permissions", { _user_id: userId });
      if (permsData) setPermissions(permsData as { module: string; action: string }[]);

      // Load session timeout setting via security definer function
      const { data: secSettings } = await supabase.rpc("get_public_security_settings");
      if (secSettings) sessionTimeoutRef.current = (secSettings as any).session_timeout_minutes;
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadUserData(user.id);
  }, [user, loadUserData]);

  // Session timeout by inactivity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!session) return;
    idleTimerRef.current = setTimeout(async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      window.location.href = "/login";
    }, sessionTimeoutRef.current * 60 * 1000);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [session, resetIdleTimer]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // For OAuth logins, try to link profile by email
        if (_event === "SIGNED_IN" && sess.user.app_metadata?.provider !== "email") {
          try {
            const { data: linkResult } = await supabase.rpc("link_oauth_profile", {
              _new_user_id: sess.user.id,
              _email: sess.user.email || "",
            });
            const result = linkResult as any;
            if (result && !result.linked) {
              // No profile found for this email - sign out
              await supabase.auth.signOut();
              setProfile(null);
              setRoles([]);
              setPermissions([]);
              setIsLoading(false);
              window.location.href = "/login?error=no_profile";
              return;
            }
          } catch (err) {
            console.error("Error linking OAuth profile:", err);
          }
        }
        setTimeout(() => loadUserData(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadUserData(sess.user.id);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string) => {
    // Check if account is locked/blocked before attempting auth
    try {
      const { data: checkData } = await supabase.functions.invoke("login-attempt", {
        body: { action: "check", email },
      });
      if (checkData && !checkData.allowed) {
        if (checkData.reason === "locked") {
          return { success: false, error: `Conta temporariamente bloqueada. Tente novamente em ${checkData.minutesLeft} minuto(s).` };
        }
        return { success: false, error: "Credenciais inválidas. Verifique e tente novamente." };
      }
    } catch {
      // If check fails, proceed with login anyway
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Record failed attempt via edge function
      try {
        await supabase.functions.invoke("login-attempt", {
          body: { action: "failed", email },
        });
      } catch {
        // Silent fail
      }
      return { success: false, error: "Credenciais inválidas. Verifique e tente novamente." };
    }

    if (data.user) {
      // Check profile status
      const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", data.user.id).single();

      if (prof?.status === "inactive" || prof?.status === "blocked") {
        await supabase.auth.signOut();
        return { success: false, error: "Credenciais inválidas. Verifique e tente novamente." };
      }

      if (prof?.locked_until && new Date(prof.locked_until) > new Date()) {
        await supabase.auth.signOut();
        return { success: false, error: "Conta temporariamente bloqueada. Tente novamente mais tarde." };
      }

      // Check password expiration
      const { data: pubSecSettings } = await supabase.rpc("get_public_security_settings") as { data: any };
      const passwordExpirationDays = pubSecSettings?.password_expiration_days;
      let passwordExpired = false;
      if (passwordExpirationDays && passwordExpirationDays > 0 && data.user.updated_at) {
        const lastPasswordChange = new Date(data.user.updated_at);
        const expirationDate = new Date(lastPasswordChange.getTime() + passwordExpirationDays * 24 * 60 * 60 * 1000);
        if (new Date() > expirationDate) {
          passwordExpired = true;
        }
      }

      // Successful login - reset attempts and update access
      await supabase.from("profiles").update({
        last_access: new Date().toISOString(),
        login_attempts: 0,
        locked_until: null,
        status: "active",
        must_change_password: prof?.must_change_password || passwordExpired,
      }).eq("user_id", data.user.id);

      await loadUserData(data.user.id);

      await supabase.from("audit_logs").insert({
        user_id: data.user.id,
        user_name: data.user.email || "Unknown",
        action: "login_success",
        module: "auth",
        details: passwordExpired ? "Login realizado - senha expirada, troca obrigatória" : "Login realizado com sucesso",
      });

      return { success: true, mustChangePassword: prof?.must_change_password || passwordExpired };
    }

    return { success: false, error: "Erro ao autenticar." };
  }, [loadUserData]);

  const logout = useCallback(async () => {
    if (user) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        user_name: user.email || "Unknown",
        action: "logout",
        module: "auth",
        details: "Logout realizado",
      });
    }
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setPermissions([]);
  }, [user]);

  const changePassword = useCallback(async (newPassword: string) => {
    const { data: secSettings } = await supabase.rpc("get_public_security_settings") as { data: any };

    if (secSettings) {
      if (newPassword.length < secSettings.min_password_length)
        return { success: false, error: `A senha deve ter no mínimo ${secSettings.min_password_length} caracteres.` };
      if (secSettings.require_uppercase && !/[A-Z]/.test(newPassword))
        return { success: false, error: "A senha deve conter ao menos uma letra maiúscula." };
      if (secSettings.require_lowercase && !/[a-z]/.test(newPassword))
        return { success: false, error: "A senha deve conter ao menos uma letra minúscula." };
      if (secSettings.require_numbers && !/\d/.test(newPassword))
        return { success: false, error: "A senha deve conter ao menos um número." };
      if (secSettings.require_special_chars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword))
        return { success: false, error: "A senha deve conter ao menos um caractere especial." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: "Erro ao alterar a senha. Tente novamente." };

    if (user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("user_id", user.id);
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        user_name: user.email || "Unknown",
        action: "password_changed",
        module: "auth",
        details: "Senha alterada com sucesso",
      });
      await loadUserData(user.id);
    }

    return { success: true };
  }, [user, loadUserData]);

  const hasPermission = useCallback((module: string, action: string) => {
    if (!user || roles.length === 0) return false;
    if (roles.some((r) => r.name === "Administrador")) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  }, [user, roles, permissions]);

  const hasAnyRole = useCallback(
    (...names: string[]) => roles.some((r) => names.includes(r.name)),
    [roles]
  );

  const isAdmin = roles.some((r) => r.name === "Administrador");
  const role = roles[0] ?? null;

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, role, roles, permissions,
        isAuthenticated: !!user && !!session,
        isAdmin, isLoading,
        login, logout, changePassword, hasPermission, hasAnyRole, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
