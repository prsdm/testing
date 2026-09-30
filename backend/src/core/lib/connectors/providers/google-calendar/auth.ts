import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import { GoogleCalendarActionsDisabledError } from "./errors";

export async function assertGoogleCalendarActionAllowed(input: {
  tenantId: string;
}) {
  const credentials = await getTenantDriveActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new GoogleCalendarActionsDisabledError();
  }
}

export function googleCalendarConnectPath(_tenantSlug: string) {
  return "/connectors";
}
