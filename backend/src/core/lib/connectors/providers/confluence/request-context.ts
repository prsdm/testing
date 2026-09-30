import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import { getTenantConfluenceActionsConfig } from "@/core/lib/db/confluence-actions-queries";
import {
  deleteConfluenceConnectorForTenantUser,
  getConfluenceConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import {
  isConfluenceIntegrationReady,
  isConfluenceOAuthConfigured,
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

export async function getConfluenceConnectorStatus(tenantSlug: string) {
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
    getTenantConfluenceActionsConfig(tenant.id),
    getConfluenceConnectorForTenantUser({
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);
  const oauthConfiguredBase = isConfluenceOAuthConfigured(config);
  const tenantReadyBase = isConfluenceIntegrationReady(config);
  const workspaceAvailable = await isIntegrationAvailableToAuthUser({
    authUserId: user.id,
    integrationKey: "confluence",
    tenantId: tenant.id,
  });
  const oauthConfigured = oauthConfiguredBase && workspaceAvailable;
  const tenantReady = tenantReadyBase && workspaceAvailable;
  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/confluence?tenantSlug=${encodeURIComponent(tenant.slug)}&name=${encodeURIComponent("Confluence")}&returnTo=${returnTo}`;

  return {
    allowRead: config.allowRead,
    confluenceUserEmail: connection?.confluenceUserEmail ?? null,
    connected: Boolean(connection),
    connectUrl,
    oauthConfigured,
    siteConfigured: Boolean(config.siteUrl),
    siteUrl: config.siteUrl ?? connection?.siteUrl ?? null,
    status: 200 as const,
    tenantReady,
    tenantSlug: tenant.slug,
    workspaceAvailable,
  };
}

export async function disconnectConfluenceForUser(tenantSlug: string) {
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

  await deleteConfluenceConnectorForTenantUser({
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
