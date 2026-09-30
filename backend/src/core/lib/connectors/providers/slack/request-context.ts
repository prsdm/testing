import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import {
  deleteSlackConnectorForTenantUser,
  getSlackConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { getTenantSlackActionsConfig } from "@/core/lib/db/slack-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import { isSlackOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

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

export async function getSlackConnectorStatus(tenantSlug: string) {
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
    getTenantSlackActionsConfig(tenant.id),
    getSlackConnectorForTenantUser({
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);
  const oauthConfiguredBase = isSlackOAuthConfigured(config);
  const workspaceAvailable = await isIntegrationAvailableToAuthUser({
    authUserId: user.id,
    integrationKey: "slack",
    tenantId: tenant.id,
  });
  const oauthConfigured = oauthConfiguredBase && workspaceAvailable;
  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/slack?tenantSlug=${encodeURIComponent(tenant.slug)}&name=${encodeURIComponent("Slack")}&returnTo=${returnTo}`;

  return {
    connected: Boolean(connection),
    connectUrl,
    oauthConfigured,
    slackUserEmail: connection?.slackUserEmail ?? null,
    status: 200 as const,
    teamName: connection?.teamName ?? null,
    tenantSlug: tenant.slug,
    workspaceAvailable,
  };
}

export async function disconnectSlackForUser(tenantSlug: string) {
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

  await deleteSlackConnectorForTenantUser({
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
