import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40) || "usuario";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const items: { name: string; email?: string | null }[] = Array.isArray(body?.items)
      ? body.items
      : [];

    if (!items.length) {
      return new Response(JSON.stringify({ error: "Nenhum item informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { name: string; email: string; user_id: string; created: boolean }[] = [];

    for (const raw of items) {
      const name = (raw?.name || "").trim();
      if (!name) continue;

      const hintEmail = (raw?.email || "").trim().toLowerCase();
      const lookupEmail = hintEmail || null;

      // 1) Tenta achar por email exato
      if (lookupEmail) {
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("user_id, name, email")
          .eq("email", lookupEmail)
          .maybeSingle();
        if (existing?.user_id) {
          results.push({ name: existing.name, email: existing.email ?? "", user_id: existing.user_id, created: false });
          continue;
        }
      }

      // 2) Tenta achar por nome (case-insensitive exato)
      const { data: byName } = await supabaseAdmin
        .from("profiles")
        .select("user_id, name, email")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      if (byName?.user_id) {
        results.push({ name: byName.name, email: byName.email ?? "", user_id: byName.user_id, created: false });
        continue;
      }

      // 3) Cria usuário provisório
      const placeholderEmail =
        lookupEmail ||
        `${slugify(name)}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@provisorio.local`;
      const tempPassword = `Prov@${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: placeholderEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name, provisional: true },
      });

      if (authError || !authUser?.user) {
        console.error("provision error", name, authError?.message);
        continue;
      }

      // O trigger handle_new_user já cria o profile; atualizamos para marcar como provisório
      await supabaseAdmin
        .from("profiles")
        .update({
          name,
          email: placeholderEmail,
          status: "inactive",
          must_change_password: true,
          notes: "Usuário provisório criado a partir de ata de reunião. Cadastro pendente de complemento.",
        })
        .eq("user_id", authUser.user.id);

      results.push({ name, email: placeholderEmail, user_id: authUser.user.id, created: true });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("provision-provisional-user error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
