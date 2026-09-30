import {
  disconnectGoogleAppForUser,
  getGoogleAppConnectorStatus,
} from "@/core/lib/connectors/providers/google-shared/request-context";

export {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/google-drive/request-context-base";

export async function getGoogleDriveConnectorStatus(tenantSlug: string) {
  const status = await getGoogleAppConnectorStatus(tenantSlug, "google-drive");
  if ("error" in status) {
    return status;
  }
  return {
    allowRead: status.allowRead,
    connected: status.connected,
    connectUrl: status.connectUrl,
    googleAccountEmail: status.googleAccountEmail,
    oauthConfigured: status.oauthConfigured,
    policyError: status.policyError,
    status: status.status,
    tenantSlug: status.tenantSlug,
  };
}

export async function disconnectGoogleDriveForUser(tenantSlug: string) {
  return await disconnectGoogleAppForUser(tenantSlug, "google-drive");
}
