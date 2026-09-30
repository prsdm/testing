import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import { GmailActionsDisabledError } from "./errors";

export async function assertGmailActionAllowed(input: { tenantId: string }) {
  const credentials = await getTenantDriveActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new GmailActionsDisabledError();
  }
}

export function gmailConnectPath(_tenantSlug: string) {
  return "/connectors";
}
