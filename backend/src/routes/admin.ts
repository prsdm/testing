import type { Application } from "express";
import * as adminAuditEventsRoute from "@/core/server/api/admin/[tenantSlug]/audit-events/route";
import * as adminBootstrapRoute from "@/core/server/api/admin/[tenantSlug]/bootstrap/route";
import * as adminGeneralLogoRoute from "@/core/server/api/admin/[tenantSlug]/general/logo/route";
import * as adminGeneralRoute from "@/core/server/api/admin/[tenantSlug]/general/route";
import * as adminGroupMembersRoute from "@/core/server/api/admin/[tenantSlug]/groups/[groupId]/members/route";
import * as adminGroupRoute from "@/core/server/api/admin/[tenantSlug]/groups/[groupId]/route";
import * as adminGroupsRoute from "@/core/server/api/admin/[tenantSlug]/groups/route";
import * as adminMcpServerRoute from "@/core/server/api/admin/[tenantSlug]/mcp-servers/[serverId]/route";
import * as adminMcpServerTestRoute from "@/core/server/api/admin/[tenantSlug]/mcp-servers/[serverId]/test/route";
import * as adminMcpServerToolsRoute from "@/core/server/api/admin/[tenantSlug]/mcp-servers/[serverId]/tools/route";
import * as adminMcpServersRoute from "@/core/server/api/admin/[tenantSlug]/mcp-servers/route";
import * as adminModelsProviderRoute from "@/core/server/api/admin/[tenantSlug]/models/providers/[provider]/route";
import * as adminModelsRoute from "@/core/server/api/admin/[tenantSlug]/models/route";
import * as adminModelsTestRoute from "@/core/server/api/admin/[tenantSlug]/models/test/route";
import * as adminRoleRoute from "@/core/server/api/admin/[tenantSlug]/roles/[roleId]/route";
import * as adminRolesRoute from "@/core/server/api/admin/[tenantSlug]/roles/route";
import * as adminSecurityAccessPolicyRoute from "@/core/server/api/admin/[tenantSlug]/security/access-policy/route";
import * as adminSecurityDomainRoute from "@/core/server/api/admin/[tenantSlug]/security/domains/[domainId]/route";
import * as adminSecurityDomainsRoute from "@/core/server/api/admin/[tenantSlug]/security/domains/route";
import * as adminSlackIntegrationRoute from "@/core/server/api/admin/[tenantSlug]/slack-integration/route";
import * as adminWebSearchRoute from "@/core/server/api/admin/[tenantSlug]/web-search/route";
import * as billingCheckoutRoute from "@/core/server/api/billing/[tenantSlug]/checkout/route";
import * as billingMemberQuotaRoute from "@/core/server/api/billing/[tenantSlug]/member-quota/route";
import * as billingPortalRoute from "@/core/server/api/billing/[tenantSlug]/portal/route";
import * as billingSeatsRoute from "@/core/server/api/billing/[tenantSlug]/seats/route";
import * as billingTopUpRoute from "@/core/server/api/billing/[tenantSlug]/top-up/route";
import * as usersMemberRoute from "@/core/server/api/users/[tenantSlug]/[memberId]/route";
import * as usersInvitesRoute from "@/core/server/api/users/[tenantSlug]/invites/route";
import * as usersOnboardingStatusRoute from "@/core/server/api/users/[tenantSlug]/onboarding-status/route";
import * as usersProfileRoute from "@/core/server/api/users/[tenantSlug]/profile/route";
import * as usersTenantRoute from "@/core/server/api/users/[tenantSlug]/route";
import { mountAppRoute } from "./mount-app-route";

export function mount(app: Application) {
  mountAppRoute(app, "/api/admin/:tenantSlug/bootstrap", adminBootstrapRoute);
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/audit-events",
    adminAuditEventsRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/mcp-servers",
    adminMcpServersRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/mcp-servers/:serverId/test",
    adminMcpServerTestRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/mcp-servers/:serverId/tools",
    adminMcpServerToolsRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/mcp-servers/:serverId",
    adminMcpServerRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/general/logo",
    adminGeneralLogoRoute
  );
  mountAppRoute(app, "/api/admin/:tenantSlug/general", adminGeneralRoute);
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/groups/:groupId/members",
    adminGroupMembersRoute
  );
  mountAppRoute(app, "/api/admin/:tenantSlug/groups/:groupId", adminGroupRoute);
  mountAppRoute(app, "/api/admin/:tenantSlug/groups", adminGroupsRoute);
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/models/providers/:provider",
    adminModelsProviderRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/models/test",
    adminModelsTestRoute
  );
  mountAppRoute(app, "/api/admin/:tenantSlug/models", adminModelsRoute);
  mountAppRoute(app, "/api/admin/:tenantSlug/roles/:roleId", adminRoleRoute);
  mountAppRoute(app, "/api/admin/:tenantSlug/roles", adminRolesRoute);
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/security/access-policy",
    adminSecurityAccessPolicyRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/security/domains/:domainId",
    adminSecurityDomainRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/security/domains",
    adminSecurityDomainsRoute
  );
  mountAppRoute(
    app,
    "/api/admin/:tenantSlug/slack-integration",
    adminSlackIntegrationRoute
  );
  mountAppRoute(app, "/api/admin/:tenantSlug/web-search", adminWebSearchRoute);

  mountAppRoute(
    app,
    "/api/billing/:tenantSlug/member-quota",
    billingMemberQuotaRoute
  );
  mountAppRoute(app, "/api/billing/:tenantSlug/checkout", billingCheckoutRoute);
  mountAppRoute(app, "/api/billing/:tenantSlug/portal", billingPortalRoute);
  mountAppRoute(app, "/api/billing/:tenantSlug/seats", billingSeatsRoute);
  mountAppRoute(app, "/api/billing/:tenantSlug/top-up", billingTopUpRoute);

  mountAppRoute(
    app,
    "/api/users/:tenantSlug/onboarding-status",
    usersOnboardingStatusRoute
  );
  mountAppRoute(app, "/api/users/:tenantSlug/invites", usersInvitesRoute);
  mountAppRoute(app, "/api/users/:tenantSlug/profile", usersProfileRoute);
  mountAppRoute(app, "/api/users/:tenantSlug/:memberId", usersMemberRoute);
  mountAppRoute(app, "/api/users/:tenantSlug", usersTenantRoute);
}
