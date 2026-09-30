import {
  type GoogleAppId,
  getGoogleWorkspaceApp,
} from "@/shared/connectors/providers/google-shared/apps";

export function googleAppOAuthConnectPath(
  tenantSlug: string,
  appId: GoogleAppId,
  options?: { returnTo?: string }
) {
  const app = getGoogleWorkspaceApp(appId);
  const connectionName = app?.connectionName ?? "Google";
  const returnTo = encodeURIComponent(options?.returnTo ?? "/connectors");

  return `/api/connectors/oauth/google-drive?tenantSlug=${encodeURIComponent(tenantSlug)}&app=${encodeURIComponent(appId)}&name=${encodeURIComponent(connectionName)}&returnTo=${returnTo}`;
}
