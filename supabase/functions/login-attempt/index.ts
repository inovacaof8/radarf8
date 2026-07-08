import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email } = await req.json();

    if (!email || !action) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: only allow check and failed actions
    if (!["check", "failed"].includes(action)) {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find user by email efficiently using admin API with per_page limit
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    // Use a more targeted approach
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, status, locked_until, login_attempts")
      .limit(1000);

    // We need to find the auth user by email
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = allUsers?.users?.find((u: any) => u.email === email);

    if (!authUser) {
      // Don't reveal whether user exists
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = profiles?.find((p: any) => p.user_id === authUser.id);

    if (!profile) {
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check") {
      if (profile.status === "blocked" || profile.status === "inactive") {
        return new Response(JSON.stringify({ allowed: false, reason: "inactive" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
        const minutesLeft = Math.ceil(
          (new Date(profile.locked_until).getTime() - Date.now()) / 60000
        );
        return new Response(
          JSON.stringify({ allowed: false, reason: "locked", minutesLeft }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If lock expired, reset
      if (profile.locked_until && new Date(profile.locked_until) <= new Date()) {
        await supabaseAdmin
          .from("profiles")
          .update({ login_attempts: 0, locked_until: null, status: "active" })
          .eq("user_id", authUser.id);
      }

      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "failed") {
      // Get security settings
      const { data: secSettings } = await supabaseAdmin
        .from("security_settings")
        .select("max_login_attempts, lockout_duration_minutes")
        .limit(1)
        .single();

      const maxAttempts = secSettings?.max_login_attempts || 5;
      const lockoutMinutes = secSettings?.lockout_duration_minutes || 30;

      const newAttempts = (profile.login_attempts || 0) + 1;
      const updateData: Record<string, unknown> = { login_attempts: newAttempts };

      if (newAttempts >= maxAttempts) {
        updateData.locked_until = new Date(
          Date.now() + lockoutMinutes * 60 * 1000
        ).toISOString();
        updateData.status = "blocked";
      }

      await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("user_id", authUser.id);

      // Get client IP from headers
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                 req.headers.get("x-real-ip") || "unknown";

      // Audit log with IP
      await supabaseAdmin.from("audit_logs").insert({
        user_id: authUser.id,
        user_name: email,
        action: "login_failed",
        module: "auth",
        ip_address: ip,
        details: `Tentativa ${newAttempts}/${maxAttempts}${newAttempts >= maxAttempts ? " — conta bloqueada" : ""}`,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          locked: newAttempts >= maxAttempts,
          attempts: newAttempts,
          maxAttempts,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
