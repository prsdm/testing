import { getGoogleDriveConnectorStatus } from "@/core/lib/connectors/providers/google-drive/request-context";
import { googleAppOAuthConnectPath } from "@/shared/connectors/providers/google-shared/connect-url";
import type { LibraryCloudExportStatusResponse } from "@/shared/library/cloud-export-types";

export async function getLibraryCloudExportStatus(args: {
  tenantSlug: string;
  returnTo?: string;
}): Promise<
  { error: string; status: number } | LibraryCloudExportStatusResponse
> {
  const returnTo = args.returnTo?.trim() || "/connectors";
  const driveStatus = await getGoogleDriveConnectorStatus(args.tenantSlug);

  if ("error" in driveStatus) {
    return {
      error: driveStatus.error ?? "Unauthorized",
      status: driveStatus.status,
    };
  }

  const driveConnected = driveStatus.connected && driveStatus.oauthConfigured;

  return {
    connected: driveConnected,
    connectUrl: driveStatus.oauthConfigured
      ? googleAppOAuthConnectPath(args.tenantSlug, "google-drive", {
          returnTo,
        })
      : null,
    oauthConfigured: driveStatus.oauthConfigured,
  };
}
