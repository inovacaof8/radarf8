import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ChangePassword from "@/pages/ChangePassword";
import Dashboard from "@/pages/Dashboard";
import PMODashboard from "@/pages/pmo/PMODashboard";
import MyWork from "@/pages/MyWork";
import PortfolioHub from "@/pages/pmo/PortfolioHub";
import ProgramsPage from "@/pages/pmo/Programs";
import ProgramDashboard from "@/pages/pmo/ProgramDashboard";
import ProjectsPage from "@/pages/pmo/Projects";
import ProjectDetailPage from "@/pages/pmo/ProjectDetail";
import RoadmapPage from "@/pages/pmo/Roadmap";
import SchedulesIndex from "@/pages/pmo/SchedulesIndex";
import DocumentsIndex from "@/pages/pmo/DocumentsIndex";
import MeetingsPage from "@/pages/pmo/Meetings";
import MeetingDetail from "@/pages/pmo/MeetingDetail";
import ActionPlansPage from "@/pages/pmo/ActionPlans";
import ActionPlanDetail from "@/pages/pmo/ActionPlanDetail";
import GedIndex from "@/pages/ged/GedIndex";
import GedNew from "@/pages/ged/GedNew";
import GedCadastros from "@/pages/ged/GedCadastros";
import GedImport from "@/pages/ged/GedImport";
import GedDetail from "@/pages/ged/GedDetail";
import AdminRoute from "@/components/AdminRoute";
import UsersPage from "@/pages/admin/Users";
import AreasPage from "@/pages/admin/Areas";
import RolesPage from "@/pages/admin/Roles";
import PermissionsPage from "@/pages/admin/Permissions";
import AuditLogsPage from "@/pages/admin/AuditLogs";
import SecuritySettings from "@/pages/admin/SecuritySettings";
import PrivacySettings from "@/pages/admin/PrivacySettings";
import GeneralSettings from "@/pages/admin/GeneralSettings";
import LegalDocuments from "@/pages/admin/LegalDocuments";
import ModulesPage from "@/pages/admin/Modules";
import VisualSettings from "@/pages/admin/VisualSettings";
import EnvironmentInfo from "@/pages/admin/EnvironmentInfo";
import UserProfile from "@/pages/UserProfile";
import AccessDenied from "@/pages/AccessDenied";
import ErrorPage from "@/pages/ErrorPage";
import PrivacyNotice from "@/pages/public/PrivacyNotice";
import TermsOfUse from "@/pages/public/TermsOfUse";
import CookiePolicy from "@/pages/public/CookiePolicy";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import NotificationsCenter from "@/pages/notifications/NotificationsCenter";
import NotificationNew from "@/pages/notifications/NotificationNew";
import NotificationDetail from "@/pages/notifications/NotificationDetail";
import NotificationsSent from "@/pages/notifications/NotificationsSent";
import NotificationTracking from "@/pages/notifications/NotificationTracking";
import NotificationGroups from "@/pages/admin/NotificationGroups";
import MeuDia from "@/pages/MeuDia";
import Notas from "@/pages/Notas";
import PdcaPlacar from "@/pages/pdca/PdcaPlacar";
import Onboarding from "@/pages/Onboarding";
import OnboardingDashboard from "@/pages/admin/OnboardingDashboard";
import Workflows from "@/pages/workflows/Workflows";
import Demands from "@/pages/workflows/Demands";
import DemandDetail from "@/pages/workflows/DemandDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Sonner />
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<PrivacyNotice />} />
            <Route path="/privacidade" element={<Navigate to="/privacy" replace />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/error" element={<ErrorPage />} />

            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/meu-trabalho" element={<MyWork />} />
              <Route path="/meu-dia" element={<MeuDia />} />
              <Route path="/notas" element={<Notas />} />
              <Route path="/pdca" element={<PdcaPlacar />} />
              <Route path="/portfolios" element={<PortfolioHub />} />
              <Route path="/programas" element={<ProgramsPage />} />
              <Route path="/programas/:id/dashboard" element={<ProgramDashboard />} />
              <Route path="/projetos" element={<ProjectsPage />} />
              <Route path="/projetos/:id" element={<ProjectDetailPage />} />
              <Route path="/cronogramas" element={<SchedulesIndex />} />
              <Route path="/documentos" element={<DocumentsIndex />} />
              <Route path="/reunioes" element={<MeetingsPage />} />
              <Route path="/reunioes/:id" element={<MeetingDetail />} />
              <Route path="/planos-acao" element={<ActionPlansPage />} />
              <Route path="/planos-acao/:id" element={<ActionPlanDetail />} />
              <Route path="/ged" element={<GedIndex />} />
              <Route path="/ged/cadastros" element={<GedCadastros />} />
              <Route path="/ged/importar" element={<GedImport />} />
              <Route path="/ged/novo" element={<GedNew />} />
              <Route path="/ged/:id" element={<GedDetail />} />
              <Route path="/roadmap" element={<RoadmapPage />} />
              <Route path="/dashboards" element={<PMODashboard />} />
              <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
              <Route path="/dashboard" element={<Navigate to="/meu-trabalho" replace />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/me" element={<Navigate to="/profile" replace />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/areas" element={<AdminRoute><AreasPage /></AdminRoute>} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/permissions" element={<PermissionsPage />} />
              <Route path="/admin/audit" element={<AuditLogsPage />} />
              <Route path="/admin/security" element={<SecuritySettings />} />
              <Route path="/admin/privacy" element={<PrivacySettings />} />
              <Route path="/admin/settings" element={<GeneralSettings />} />
              <Route path="/admin/legal" element={<LegalDocuments />} />
              <Route path="/admin/onboarding" element={<AdminRoute><OnboardingDashboard /></AdminRoute>} />
              <Route path="/admin/modules" element={<ModulesPage />} />
              <Route path="/admin/visual" element={<VisualSettings />} />
              <Route path="/admin/environment" element={<EnvironmentInfo />} />
              <Route path="/admin/grupos-notificacao" element={<NotificationGroups />} />
              <Route path="/notificacoes" element={<NotificationsCenter />} />
              <Route path="/notificacoes/nova" element={<NotificationNew />} />
              <Route path="/notificacoes/enviadas" element={<NotificationsSent />} />
              <Route path="/notificacoes/:id" element={<NotificationDetail />} />
              <Route path="/notificacoes/:id/acompanhamento" element={<NotificationTracking />} />
              <Route path="/workflows" element={<AdminRoute><Workflows /></AdminRoute>} />
              <Route path="/demandas" element={<Demands />} />
              <Route path="/demandas/:id" element={<DemandDetail />} />
            </Route>

            <Route path="/" element={<Navigate to="/meu-trabalho" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
