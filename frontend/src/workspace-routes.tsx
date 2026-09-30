import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./layouts/admin-layout";
import { WorkspaceLayout } from "./layouts/workspace-layout";
import { AdminGroupDetailRoute } from "./pages/admin/admin-group-detail-route";
import { AdminIntegrationDetailRoute } from "./pages/admin/admin-integration-detail-route";
import {
  AdminAnalyticsPage,
  AdminAuditPage,
  AdminBillingPage,
  AdminGeneralPage,
  AdminGroupsPage,
  AdminIntegrationsPage,
  AdminMcpPage,
  AdminModelsPage,
  AdminNewGroupPage,
  AdminRolesPage,
  AdminSecurityPage,
  AdminSlackIntegrationPage,
  AdminUsersPage,
  AdminWebSearchPage,
} from "./pages/admin/admin-routes";
import { ChannelsPage } from "./pages/channels-page";
import { ChatConversationPage, ChatHomePage } from "./pages/chat-routes";
import { ConnectorsPage } from "./pages/connectors-page";
import { KnowledgeBaseDetailPage } from "./pages/knowledge-base-detail-page";
import { KnowledgeBasesPage } from "./pages/knowledge-bases-page";
import { LibraryPage } from "./pages/library-page";
import { SourcesPage } from "./pages/sources-page";

/** Workspace + admin routes — lazy-loaded so /login does not pull the full app graph. */
export default function WorkspaceRoutes() {
  return (
    <Routes>
      <Route element={<WorkspaceLayout />}>
        <Route element={<ChatHomePage />} path="/" />
        <Route element={<ChatConversationPage />} path="/c/:id" />
        <Route element={<LibraryPage />} path="/library" />
        <Route element={<SourcesPage />} path="/sources" />
        <Route element={<ConnectorsPage />} path="/connectors" />
        <Route element={<ChannelsPage />} path="/channels" />
        <Route element={<KnowledgeBasesPage />} path="/knowledge-bases" />
        <Route
          element={<KnowledgeBaseDetailPage />}
          path="/knowledge-bases/:knowledgeBaseId"
        />
        <Route element={<AdminLayout />} path="/admin">
          <Route element={<Navigate replace to="general" />} index />
          <Route
            element={<Navigate replace to="/admin/general" />}
            path="overview"
          />
          <Route element={<AdminGeneralPage />} path="general" />
          <Route element={<AdminIntegrationsPage />} path="integrations" />
          <Route element={<AdminMcpPage />} path="mcp" />
          <Route
            element={<AdminIntegrationDetailRoute />}
            path="integrations/:integrationKey"
          />
          <Route
            element={<AdminSlackIntegrationPage />}
            path="slack-integration"
          />
          <Route element={<AdminModelsPage />} path="models" />
          <Route element={<AdminWebSearchPage />} path="web-search" />
          <Route element={<AdminUsersPage />} path="users" />
          <Route element={<AdminGroupsPage />} path="groups" />
          <Route element={<AdminNewGroupPage />} path="groups/new" />
          <Route element={<AdminGroupDetailRoute />} path="groups/:groupId" />
          <Route element={<AdminRolesPage />} path="roles" />
          <Route
            element={<Navigate replace to="/admin/roles" />}
            path="roles/new"
          />
          <Route
            element={<Navigate replace to="/admin/roles" />}
            path="roles/:roleId"
          />
          <Route element={<AdminSecurityPage />} path="security" />
          <Route element={<AdminAnalyticsPage />} path="analytics" />
          <Route element={<AdminAuditPage />} path="audit" />
          <Route element={<AdminBillingPage />} path="billing" />
        </Route>
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  );
}
