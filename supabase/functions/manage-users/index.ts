import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller using getClaims
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = claimsData.claims.sub;

    // Check if caller is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: callerId, _role: "Administrador" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, name, roleId, roleIds, notes } = body;
      if (!email || !name) {
        return new Response(JSON.stringify({ error: "E-mail e nome são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Aceita tanto `roleIds` (array — múltiplos perfis) quanto `roleId` legado.
      const finalRoleIds: string[] = Array.isArray(roleIds)
        ? roleIds.filter((x: any) => typeof x === "string" && x)
        : roleId ? [roleId] : [];

      const tempPassword = `Temp@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      let authUser: any = null;
      let authError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name },
        });
        authUser = res.data;
        authError = res.error;
        if (!authError || (authError as any)?.name !== "AuthRetryableFetchError") break;
        console.warn(`createUser retry ${attempt + 1} after retryable error`);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }

      if (authError) {
        console.error("createUser authError:", authError);
        const aMsg = (authError as any)?.message || (authError as any)?.code || JSON.stringify(authError);
        if (aMsg.includes("already been registered") || aMsg.includes("already registered")) {
          return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const friendly = (authError as any)?.name === "AuthRetryableFetchError"
          ? "Falha temporária ao contatar o serviço de autenticação. Tente novamente em instantes."
          : (aMsg || "Erro ao criar usuário");
        return new Response(JSON.stringify({ error: friendly }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("profiles").update({
        name,
        email,
        status: "active",
        must_change_password: true,
        notes: notes || null,
      }).eq("user_id", authUser.user.id);

      if (finalRoleIds.length > 0) {
        await supabaseAdmin.from("user_roles").insert(
          finalRoleIds.map((rid: string) => ({ user_id: authUser.user.id, role_id: rid }))
        );
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id, tempPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const { userId } = body;
      const tempPassword = `Reset@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: tempPassword });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true, tempPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_create") {
      const { users: userList } = body;
      if (!Array.isArray(userList) || userList.length === 0) {
        return new Response(JSON.stringify({ error: "Lista de usuários vazia" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (userList.length > 200) {
        return new Response(JSON.stringify({ error: "Máximo de 200 usuários por importação" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: allRoles } = await supabaseAdmin.from("roles").select("id, name").eq("is_active", true);
      const roleMap = new Map((allRoles || []).map((r: any) => [r.name.toLowerCase().trim(), r.id]));

      const results: { row: number; email: string; status: string; tempPassword?: string; error?: string }[] = [];

      for (let i = 0; i < userList.length; i++) {
        const u = userList[i];
        const email = (u.email || "").trim();
        const name = (u.name || "").trim();
        const roleRaw = (u.role || "").toString().trim();
        const notes = (u.notes || "").trim();

        if (!email || !name) {
          results.push({ row: i + 2, email, status: "error", error: "Nome e e-mail obrigatórios" });
          continue;
        }

        // Múltiplos perfis: aceita separadores ; , | / na coluna `perfil`.
        const roleNames = roleRaw
          ? roleRaw.split(/[;,|/]+/).map((s: string) => s.trim()).filter(Boolean)
          : [];
        const rowRoleIds = roleNames
          .map((n: string) => roleMap.get(n.toLowerCase()))
          .filter((x: any): x is string => !!x);

        const tempPassword = `Temp@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { name },
        });

        if (authError) {
          results.push({ row: i + 2, email, status: "error", error: authError.message.includes("already been registered") ? "E-mail já cadastrado" : authError.message });
          continue;
        }

        await supabaseAdmin.from("profiles").update({ name, email, status: "active", must_change_password: true, notes: notes || null }).eq("user_id", authUser.user.id);
        if (rowRoleIds.length > 0) {
          await supabaseAdmin.from("user_roles").insert(
            rowRoleIds.map((rid: string) => ({ user_id: authUser.user.id, role_id: rid }))
          );
        }

        results.push({ row: i + 2, email, status: "success", tempPassword });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { userId } = body;
      await supabaseAdmin.from("profiles").update({ status: "inactive" }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "export_user_data") {
      // LGPD: Export all user data for portability
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: profileData } = await supabaseAdmin.from("profiles").select("*").eq("user_id", userId).single();
      const { data: userRoles } = await supabaseAdmin.from("user_roles").select("*, roles(name)").eq("user_id", userId);
      const { data: acceptances } = await supabaseAdmin.from("legal_acceptances").select("*, legal_documents(title, type)").eq("user_id", userId);
      const { data: auditLogs } = await supabaseAdmin.from("audit_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(500);

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profileData,
        roles: userRoles,
        legal_acceptances: acceptances,
        audit_trail: auditLogs,
      };

      // Log the export
      await supabaseAdmin.from("audit_logs").insert({
        user_id: callerId,
        user_name: claimsData.claims.email || "Admin",
        action: "user_data_exported",
        module: "lgpd",
        entity: "user",
        entity_id: userId,
        details: `Dados do usuário exportados (LGPD Art. 18)`,
      });

      return new Response(JSON.stringify({ success: true, data: exportData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "anonymize") {
      // LGPD: Anonymize user data (right to be forgotten)
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("profiles").update({
        name: "Usuário Anonimizado",
        notes: null,
        status: "inactive",
      }).eq("user_id", userId);

      // Anonymize audit logs
      await supabaseAdmin.from("audit_logs").update({
        user_name: "Anonimizado",
        details: "[Dados anonimizados por solicitação LGPD]",
        previous_value: null,
        new_value: null,
      }).eq("user_id", userId);

      // Delete legal acceptances
      await supabaseAdmin.from("legal_acceptances").delete().eq("user_id", userId);

      // Log the anonymization
      await supabaseAdmin.from("audit_logs").insert({
        user_id: callerId,
        user_name: claimsData.claims.email || "Admin",
        action: "user_anonymized",
        module: "lgpd",
        entity: "user",
        entity_id: userId,
        details: `Dados do usuário anonimizados (LGPD Art. 18 - Direito ao Esquecimento)`,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("manage-users error:", err);
    const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : JSON.stringify(err));
    return new Response(JSON.stringify({ error: msg || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
