import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import {
  deleteNotionConnectorForTenantUser,
  getNotionConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { getTenantNotionActionsConfig } from "@/core/lib/db/notion-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import { isNotionOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

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

export async function getNotionConnectorStatus(tenantSlug: string) {
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
    getTenantNotionActionsConfig(tenant.id),
    getNotionConnectorForTenantUser({
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);
  const oauthConfiguredBase = isNotionOAuthConfigured(config);
  const workspaceAvailable = await isIntegrationAvailableToAuthUser({
    authUserId: user.id,
    integrationKey: "notion",
    tenantId: tenant.id,
  });
  const oauthConfigured = oauthConfiguredBase && workspaceAvailable;
  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/notion?tenantSlug=${encodeURIComponent(tenant.slug)}&name=${encodeURIComponent("Notion")}&returnTo=${returnTo}`;

  return {
    allowRead: config.allowRead,
    connected: Boolean(connection),
    connectUrl,
    notionUserEmail: connection?.notionUserEmail ?? null,
    oauthConfigured,
    status: 200 as const,
    tenantSlug: tenant.slug,
    workspaceAvailable,
    workspaceName: connection?.workspaceName ?? null,
  };
}

export async function disconnectNotionForUser(tenantSlug: string) {
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

  await deleteNotionConnectorForTenantUser({
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
