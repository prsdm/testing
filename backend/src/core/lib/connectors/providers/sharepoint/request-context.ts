import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import {
  deleteSharePointConnectorForTenantUser,
  getSharePointConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { getTenantSharePointActionsConfig } from "@/core/lib/db/sharepoint-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import { isSharePointOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

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

export async function getSharePointConnectorStatus(tenantSlug: string) {
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
    getTenantSharePointActionsConfig(tenant.id),
    getSharePointConnectorForTenantUser({
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);
  const oauthConfiguredBase = isSharePointOAuthConfigured(config);
  const workspaceAvailable = await isIntegrationAvailableToAuthUser({
    authUserId: user.id,
    integrationKey: "sharepoint",
    tenantId: tenant.id,
  });
  const oauthConfigured = oauthConfiguredBase && workspaceAvailable;
  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/sharepoint?tenantSlug=${encodeURIComponent(tenant.slug)}&name=${encodeURIComponent("SharePoint")}&returnTo=${returnTo}`;

  return {
    allowRead: config.allowRead,
    connected: Boolean(connection),
    connectUrl,
    oauthConfigured,
    sharePointUserEmail: connection?.sharePointUserEmail ?? null,
    status: 200 as const,
    workspaceAvailable,
  };
}

export async function disconnectSharePointForUser(tenantSlug: string) {
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

  await deleteSharePointConnectorForTenantUser({
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
