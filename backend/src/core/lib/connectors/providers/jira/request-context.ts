import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import {
  deleteJiraConnectorForTenantUser,
  getJiraConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { getTenantJiraActionsConfig } from "@/core/lib/db/jira-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import {
  isJiraIntegrationReady,
  isJiraOAuthConfigured,
} from "@/core/lib/integrations/integration-readiness";

export function resolveTenantForUser(input: {
  tenantSlug: string;
  userEmail: string;
  authUserId: string;
}) {
  return resolveActiveTenantForUser(input);
}

export async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }
  return session.user;
}

export async function getJiraConnectorStatus(tenantSlug: string) {
  const user = await requireSessionUser();
  if (!user?.email || !user.id) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const tenant = await resolveTenantForUser({
    authUserId: user.id,
    tenantSlug,
    userEmail: user.email,
  });
  if (!tenant) {
    return { error: "Forbidden", status: 403 as const };
  }

  const [config, connection] = await Promise.all([
    getTenantJiraActionsConfig(tenant.id),
    getJiraConnectorForTenantUser({
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);
  const oauthConfiguredBase = isJiraOAuthConfigured(config);
  const tenantReadyBase = isJiraIntegrationReady(config);
  const workspaceAvailable = await isIntegrationAvailableToAuthUser({
    authUserId: user.id,
    integrationKey: "jira",
    tenantId: tenant.id,
  });
  const oauthConfigured = oauthConfiguredBase && workspaceAvailable;
  const tenantReady = tenantReadyBase && workspaceAvailable;
  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/jira?tenantSlug=${encodeURIComponent(tenant.slug)}&name=${encodeURIComponent("Jira")}&returnTo=${returnTo}`;

  return {
    connected: Boolean(connection),
    connectUrl,
    jiraUserEmail: connection?.jiraUserEmail ?? null,
    oauthConfigured,
    siteConfigured: Boolean(config.siteUrl),
    siteName: connection?.siteName ?? null,
    siteUrl: config.siteUrl,
    status: 200 as const,
    tenantReady,
    tenantSlug: tenant.slug,
    workspaceAvailable,
  };
}

export async function disconnectJiraForUser(tenantSlug: string) {
  const user = await requireSessionUser();
  if (!user?.email || !user.id) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const tenant = await resolveTenantForUser({
    authUserId: user.id,
    tenantSlug,
    userEmail: user.email,
  });
  if (!tenant) {
    return { error: "Forbidden", status: 403 as const };
  }

  await deleteJiraConnectorForTenantUser({
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
