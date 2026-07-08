import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // NOTE: This seed intentionally does NOT create any users.
  // When this project is cloned/remixed, no user accounts are carried over.
  // The first administrator must be created manually via the Users admin screen
  // (or by signing up and being promoted to the "Administrador" role).

  // Ensure admin role exists (structural only)
  const { data: adminRole } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", "Administrador")
    .single();

  if (!adminRole) {
    return new Response(JSON.stringify({ error: "Role Administrador not found. Run seed migration first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Seed initial legal documents if not exist
  const { data: existingDocs } = await supabaseAdmin.from("legal_documents").select("id");
  if (!existingDocs?.length) {
    const docsToCreate = [
      { type: "privacy", title: "Aviso de Privacidade" },
      { type: "terms", title: "Termos de Uso" },
      { type: "cookies", title: "Política de Cookies" },
    ];
    for (const doc of docsToCreate) {
      const { data: newDoc } = await supabaseAdmin.from("legal_documents").insert(doc).select().single();
      if (newDoc) {
        await supabaseAdmin.from("legal_document_versions").insert({
          document_id: newDoc.id,
          version: 1,
          content: `Conteúdo inicial do documento: ${doc.title}. Este documento deve ser editado pelo administrador.`,
          requires_acceptance: true,
          published_by: "Sistema",
        });
      }
    }
  }

  // Seed modules if not exist
  const { data: existingModules } = await supabaseAdmin.from("modules").select("id");
  if (!existingModules?.length) {
    const modulesToCreate = [
      { name: "Dashboard", slug: "dashboard", description: "Painel principal", icon: "LayoutDashboard" },
      { name: "Usuários", slug: "users", description: "Gestão de usuários", icon: "Users" },
      { name: "Perfis", slug: "roles", description: "Gestão de perfis", icon: "Shield" },
      { name: "Permissões", slug: "permissions", description: "Gestão de permissões", icon: "Lock" },
      { name: "Segurança", slug: "security", description: "Configurações de segurança", icon: "ShieldCheck" },
      { name: "Privacidade", slug: "privacy", description: "Configurações de privacidade", icon: "Eye" },
      { name: "Documentos Legais", slug: "legal-documents", description: "Gestão de documentos legais", icon: "FileText" },
      { name: "Auditoria", slug: "audit", description: "Logs e auditoria", icon: "FileText" },
      { name: "Configurações", slug: "settings", description: "Configurações gerais", icon: "Settings" },
      { name: "Módulos", slug: "modules", description: "Catálogo de módulos", icon: "Package" },
      { name: "Visual", slug: "visual", description: "Identidade visual", icon: "Palette" },
      { name: "Ambiente", slug: "environment", description: "Governança de ambiente", icon: "Server" },
    ];
    await supabaseAdmin.from("modules").insert(modulesToCreate);
  }

  // Seed permissions if not exist
  const { data: existingPerms } = await supabaseAdmin.from("permissions").select("id");
  if (!existingPerms?.length) {
    const moduleSlugs = ["dashboard", "users", "roles", "permissions", "security", "privacy", "legal-documents", "audit", "settings", "modules", "visual", "environment"];
    const actions = ["view", "create", "edit", "delete", "export", "admin"];
    const permsToInsert = moduleSlugs.flatMap((m) => actions.map((a) => ({
      module: m,
      action: a,
      description: `${a} em ${m}`,
    })));
    await supabaseAdmin.from("permissions").insert(permsToInsert);

    // Assign all permissions to admin role (role exists but has no users yet)
    const { data: allPerms } = await supabaseAdmin.from("permissions").select("id");
    if (allPerms) {
      const rpInsert = allPerms.map((p) => ({ role_id: adminRole.id, permission_id: p.id }));
      await supabaseAdmin.from("role_permissions").insert(rpInsert);
    }
  }

  return new Response(JSON.stringify({
    message: "Structural seed completed. No users were created — first admin must be created manually.",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
