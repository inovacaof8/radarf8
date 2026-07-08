import type { AppData, Permission, RolePermission } from "@/types";

const STORAGE_KEY = "gov_app_data";

const MODULES = [
  "dashboard", "users", "roles", "permissions", "security",
  "privacy", "legal-documents", "audit", "settings", "modules", "visual", "environment"
];

const ACTIONS = ["view", "create", "edit", "delete", "export", "admin"];

function generatePermissions(): Permission[] {
  const perms: Permission[] = [];
  let i = 0;
  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      perms.push({
        id: `perm-${i++}`,
        module: mod,
        action,
        description: `${action} em ${mod}`,
      });
    }
  }
  return perms;
}

function generateAdminRolePermissions(permissions: Permission[]): RolePermission[] {
  return permissions.map((p) => ({ roleId: "role-admin", permissionId: p.id }));
}

function generateManagerRolePermissions(permissions: Permission[]): RolePermission[] {
  return permissions
    .filter((p) => ["view", "edit", "create"].includes(p.action))
    .map((p) => ({ roleId: "role-manager", permissionId: p.id }));
}

function generateUserRolePermissions(permissions: Permission[]): RolePermission[] {
  return permissions
    .filter((p) => p.action === "view" && ["dashboard"].includes(p.module))
    .map((p) => ({ roleId: "role-user", permissionId: p.id }));
}

function createInitialData(): AppData {
  const permissions = generatePermissions();
  const rolePermissions = [
    ...generateAdminRolePermissions(permissions),
    ...generateManagerRolePermissions(permissions),
    ...generateUserRolePermissions(permissions),
  ];

  return {
    users: [
      {
        id: "user-admin",
        name: "Administrador Principal",
        email: "christiannepimenta@gmail.com",
        roleId: "role-admin",
        status: "active",
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        lastAccess: null,
        password: "Admin@123",
        notes: "Usuário administrador criado automaticamente pelo seed inicial.",
        loginAttempts: 0,
        lockedUntil: null,
      },
    ],
    roles: [
      { id: "role-admin", name: "Administrador", description: "Acesso total ao sistema", isSystem: true, isActive: true, createdAt: new Date().toISOString() },
      { id: "role-manager", name: "Gestor", description: "Acesso intermediário conforme permissões", isSystem: true, isActive: true, createdAt: new Date().toISOString() },
      { id: "role-user", name: "Usuário Padrão", description: "Acesso básico às funcionalidades permitidas", isSystem: true, isActive: true, createdAt: new Date().toISOString() },
    ],
    permissions,
    rolePermissions,
    auditLogs: [
      {
        id: "log-seed",
        userId: "system",
        userName: "Sistema",
        action: "seed",
        module: "system",
        details: "Seed inicial do sistema executado com sucesso.",
        createdAt: new Date().toISOString(),
      },
    ],
    legalDocuments: [
      { id: "doc-privacy", type: "privacy", title: "Aviso de Privacidade", isActive: true, createdAt: new Date().toISOString() },
      { id: "doc-terms", type: "terms", title: "Termos de Uso", isActive: true, createdAt: new Date().toISOString() },
      { id: "doc-cookies", type: "cookies", title: "Política de Cookies", isActive: true, createdAt: new Date().toISOString() },
    ],
    legalDocumentVersions: [
      {
        id: "ver-privacy-1", documentId: "doc-privacy", version: 1,
        content: "Este Aviso de Privacidade descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais em conformidade com a legislação vigente.\n\n1. Dados Coletados: Coletamos dados de identificação, contato e acesso necessários para o funcionamento da plataforma.\n\n2. Finalidade: Os dados são utilizados exclusivamente para operação, segurança e melhoria do sistema.\n\n3. Compartilhamento: Não compartilhamos dados pessoais com terceiros sem consentimento prévio.\n\n4. Retenção: Os dados são mantidos pelo período necessário ao cumprimento das finalidades descritas.\n\n5. Direitos do Titular: Você pode solicitar acesso, correção, exclusão ou portabilidade de seus dados a qualquer momento.",
        requiresAcceptance: true, publishedAt: new Date().toISOString(), publishedBy: "Sistema",
      },
      {
        id: "ver-terms-1", documentId: "doc-terms", version: 1,
        content: "Termos de Uso da Plataforma\n\n1. Aceitação: Ao acessar esta plataforma, você concorda com estes termos.\n\n2. Uso Adequado: A plataforma deve ser utilizada de forma ética e em conformidade com a legislação.\n\n3. Responsabilidades: O usuário é responsável por manter a confidencialidade de suas credenciais.\n\n4. Propriedade Intelectual: Todo o conteúdo da plataforma é protegido por direitos autorais.\n\n5. Modificações: Estes termos podem ser atualizados periodicamente.",
        requiresAcceptance: true, publishedAt: new Date().toISOString(), publishedBy: "Sistema",
      },
      {
        id: "ver-cookies-1", documentId: "doc-cookies", version: 1,
        content: "Política de Cookies\n\n1. O que são Cookies: Cookies são pequenos arquivos armazenados no seu navegador.\n\n2. Tipos Utilizados: Utilizamos cookies essenciais para funcionamento e cookies analíticos para melhoria.\n\n3. Gerenciamento: Você pode configurar seu navegador para recusar cookies.\n\n4. Consentimento: Ao continuar navegando, você concorda com o uso de cookies conforme esta política.",
        requiresAcceptance: false, publishedAt: new Date().toISOString(), publishedBy: "Sistema",
      },
    ],
    legalAcceptances: [],
    modules: [
      { id: "mod-auth", name: "Autenticação", description: "Login, logout, recuperação e troca de senha", slug: "auth", isActive: true, icon: "KeyRound" },
      { id: "mod-users", name: "Usuários", description: "Gestão completa de usuários do sistema", slug: "users", isActive: true, icon: "Users" },
      { id: "mod-roles", name: "Perfis", description: "Gestão de perfis e papéis", slug: "roles", isActive: true, icon: "Shield" },
      { id: "mod-perms", name: "Permissões", description: "Gestão de permissões por perfil", slug: "permissions", isActive: true, icon: "Lock" },
      { id: "mod-privacy", name: "Privacidade", description: "Configurações e gestão de privacidade", slug: "privacy", isActive: true, icon: "Eye" },
      { id: "mod-security", name: "Segurança", description: "Políticas e configurações de segurança", slug: "security", isActive: true, icon: "ShieldCheck" },
      { id: "mod-audit", name: "Auditoria", description: "Logs e trilha de auditoria", slug: "audit", isActive: true, icon: "FileText" },
      { id: "mod-settings", name: "Configurações", description: "Parametrizações gerais do sistema", slug: "settings", isActive: true, icon: "Settings" },
    ],
    securitySettings: {
      minPasswordLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      passwordHistoryCount: 3,
      passwordExpirationDays: 90,
      maxLoginAttempts: 5,
      lockoutDurationMinutes: 30,
      sessionTimeoutMinutes: 30,
      requirePasswordChangeOnFirstAccess: true,
      allowMultipleSessions: false,
      mfaEnabled: false,
    },
    systemSettings: {
      appName: "Base de Governança de Aplicações",
      appShortName: "GovBase",
      appDescription: "Plataforma base corporativa para governança, administração e controle de acesso.",
      primaryColor: "#2563EB",
      secondaryColor: "#64748B",
      backgroundColor: "#F5F7FA",
      logoUrl: "",
      faviconUrl: "",
      environment: "development",
      version: "1.0.0",
      footerText: "© 2026 Base de Governança de Aplicações. Todos os direitos reservados.",
      contactEmail: "admin@govbase.com.br",
      language: "pt-BR",
      lastUpdated: new Date().toISOString(),
    },
    privacySettings: {
      retentionDays: 365,
      showCookieBanner: true,
      dataCategories: ["Identificação", "Contato", "Acesso", "Navegação"],
      dpoEmail: "dpo@govbase.com.br",
      dpoName: "Encarregado de Dados",
    },
  };
}

let _data: AppData | null = null;

export function getData(): AppData {
  if (_data) return _data;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      _data = JSON.parse(stored) as AppData;
      return _data;
    } catch {
      // ignore
    }
  }
  _data = createInitialData();
  saveData(_data);
  return _data;
}

export function saveData(data: AppData) {
  _data = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateData(updater: (data: AppData) => AppData) {
  const current = getData();
  const updated = updater(current);
  saveData(updated);
  return updated;
}

export function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  _data = null;
  return getData();
}

export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
