import { getTenantNotionActionsOAuthCredentials } from "../../../db/notion-actions-queries";

export async function assertNotionActionAllowed(input: {
  tenantId: string;
  action: "read" | "create" | "write";
}) {
  const credentials = await getTenantNotionActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new Error("Notion actions are disabled by admin.");
  }
  if (input.action === "read" && !credentials.settings.allowRead) {
    throw new Error("Notion sync/read is disabled by admin policy.");
  }
}
