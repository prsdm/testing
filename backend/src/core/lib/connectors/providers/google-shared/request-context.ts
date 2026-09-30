import { assertGoogleAccountMatchesUserEmail } from "@/core/lib/connectors/providers/google-drive/auth";
import {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/google-drive/request-context-base";
import {
  deleteAllGoogleAppConnectionsForTenantUser,
  deleteGoogleAppConnectorForTenantUser,
  getGoogleAppConnectorForTenantUser,
  migrateLegacyUnifiedGoogleConnectorIfNeeded,
} from "@/core/lib/connectors/providers/google-shared/queries";
import { getTenantDriveActionsConfig } from "@/core/lib/db/drive-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import { isDriveOAuthConfigured } from "@/core/lib/integrations/integration-readiness";
import {
  type GoogleAppId,
  getGoogleWorkspaceApp,
} from "@/shared/connectors/providers/google-shared/apps";
import { integrationKeyForGoogleApp } from "@/shared/integrations/integration-catalog";

export async function getGoogleAppConnectorStatus(
  tenantSlug: string,
  appId: GoogleAppId
) {
  const app = getGoogleWorkspaceApp(appId);
  if (!app) {
    return { error: "Unknown Google app.", status: 400 as const };
  }

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

  await migrateLegacyUnifiedGoogleConnectorIfNeeded({
    tenantId: tenant.id,
    userId: user.id,
  });

  const [config, existingConnection] = await Promise.all([
    getTenantDriveActionsConfig(tenant.id),
    getGoogleAppConnectorForTenantUser({
      appId,
      tenantId: tenant.id,
      userId: user.id,
    }),
  ]);

  let connection = existingConnection;
  let policyError: string | null = null;
  if (connection?.googleAccountEmail) {
    try {
      assertGoogleAccountMatchesUserEmail({
        googleAccountEmail: connection.googleAccountEmail,
        userEmail: user.email,
      });
    } catch {
      await deleteAllGoogleAppConnectionsForTenantUser({
        tenantId: tenant.id,
        userId: user.id,
      });
      connection = null;
      policyError = "Google account must match your signed-in workspace email.";
    }
  }

  const oauthConfigured = isDriveOAuthConfigured(config);
  const integrationKey = integrationKeyForGoogleApp(appId);
  const workspaceAvailable = integrationKey
    ? await isIntegrationAvailableToAuthUser({
        authUserId: user.id,
        integrationKey,
        tenantId: tenant.id,
      })
    : false;

  const returnTo = encodeURIComponent("/connectors");
  const connectUrl = `/api/connectors/oauth/google-drive?tenantSlug=${encodeURIComponent(tenant.slug)}&app=${encodeURIComponent(appId)}&name=${encodeURIComponent(app.connectionName)}&returnTo=${returnTo}`;

  return {
    allowRead: config.allowRead,
    appId,
    connected: Boolean(connection),
    connectedParam: app.connectedParam,
    connectLabel: app.connectLabel,
    connectUrl,
    description: app.description,
    googleAccountEmail: connection?.googleAccountEmail ?? null,
    oauthConfigured: oauthConfigured && workspaceAvailable,
    policyError,
    status: 200 as const,
    tenantSlug: tenant.slug,
    uiProvider: app.uiProvider,
    workspaceAvailable,
  };
}

export async function disconnectGoogleAppForUser(
  tenantSlug: string,
  appId: GoogleAppId
) {
  const app = getGoogleWorkspaceApp(appId);
  if (!app) {
    return { error: "Unknown Google app.", status: 400 as const };
  }

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

  await deleteGoogleAppConnectorForTenantUser({
    appId,
    tenantId: tenant.id,
    userId: user.id,
  });

  return { ok: true as const };
}
