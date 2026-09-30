import { getTenantSharePointActionsOAuthCredentials } from "@/core/lib/db/sharepoint-actions-queries";

export async function assertSharePointActionAllowed(input: {
  tenantId: string;
  action: "read" | "write";
}) {
  const credentials = await getTenantSharePointActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new Error("SharePoint integration is disabled by admin.");
  }
  if (input.action === "read" && !credentials.settings.allowRead) {
    throw new Error("SharePoint read is disabled by admin policy.");
  }
}
