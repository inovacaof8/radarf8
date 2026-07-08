export type UserStatus = 'active' | 'inactive' | 'blocked';
export type Environment = 'development' | 'staging' | 'production';
export type LegalDocType = 'privacy' | 'terms' | 'cookies';

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  lastAccess: string | null;
  password: string;
  notes?: string;
  loginAttempts: number;
  lockedUntil: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  description: string;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface LegalDocument {
  id: string;
  type: LegalDocType;
  title: string;
  isActive: boolean;
  createdAt: string;
}

export interface LegalDocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  requiresAcceptance: boolean;
  publishedAt: string;
  publishedBy: string;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  versionId: string;
  acceptedAt: string;
}

export interface SystemModule {
  id: string;
  name: string;
  description: string;
  slug: string;
  isActive: boolean;
  icon: string;
}

export interface SecuritySettings {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  passwordHistoryCount: number;
  passwordExpirationDays: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  requirePasswordChangeOnFirstAccess: boolean;
  allowMultipleSessions: boolean;
  mfaEnabled: boolean;
}

export interface SystemSettings {
  appName: string;
  appShortName: string;
  appDescription: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  logoUrl: string;
  faviconUrl: string;
  environment: Environment;
  version: string;
  footerText: string;
  contactEmail: string;
  language: string;
  lastUpdated: string;
}

export interface PrivacySettings {
  retentionDays: number;
  showCookieBanner: boolean;
  dataCategories: string[];
  dpoEmail: string;
  dpoName: string;
}

export interface AppData {
  users: User[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
  auditLogs: AuditLog[];
  legalDocuments: LegalDocument[];
  legalDocumentVersions: LegalDocumentVersion[];
  legalAcceptances: LegalAcceptance[];
  modules: SystemModule[];
  securitySettings: SecuritySettings;
  systemSettings: SystemSettings;
  privacySettings: PrivacySettings;
}
