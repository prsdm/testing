import {
  executeConfluence,
  isConfluenceToolId,
} from "@/core/lib/connectors/providers/confluence/adapter";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import {
  executeGmail,
  isGmailToolId,
} from "@/core/lib/connectors/providers/gmail/adapter";
import {
  executeGoogleCalendar,
  isGoogleCalendarToolId,
} from "@/core/lib/connectors/providers/google-calendar/adapter";
import {
  executeGoogleDrive,
  isGoogleDriveToolId,
} from "@/core/lib/connectors/providers/google-drive/adapter";
import {
  executeJira,
  isJiraToolId,
} from "@/core/lib/connectors/providers/jira/adapter";
import {
  executeNotion,
  isNotionToolId,
} from "@/core/lib/connectors/providers/notion/adapter";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/registry";
import {
  executeSharePoint,
  isSharePointToolId,
} from "@/core/lib/connectors/providers/sharepoint/adapter";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import {
  executeSlack,
  isSlackToolId,
} from "@/core/lib/connectors/providers/slack/adapter";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import {
  getToolConfigByIdForTenant,
  isPersonalConnectorProvider,
} from "@/core/lib/db/connector-queries";
import { GMAIL_PROVIDER_ID } from "@/shared/connectors/providers/gmail/provider";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/shared/connectors/providers/google-calendar/provider";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import {
  getCredentialRowForResolve,
  getResolvedToolInputParams,
} from "./resolve-config";

export async function executeConnectorTool(args: {
  tenantId: string;
  userId: string;
  toolConfigId: string;
  toolId: string;
  providerId: string;
  toolInputOverrides?: Record<string, unknown>;
  input: Record<string, unknown>;
}): Promise<unknown> {
  const row = await getToolConfigByIdForTenant({
    id: args.toolConfigId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!row) {
    throw new Error("Tool configuration not found");
  }
  if (row.toolId !== args.toolId || row.providerId !== args.providerId) {
    throw new Error("Tool configuration mismatch");
  }

  const credentialRow = await getCredentialRowForResolve(
    row.credentialId,
    args.tenantId,
    args.userId,
    args.providerId
  );
  if (
    row.credentialId &&
    !credentialRow &&
    isPersonalConnectorProvider(args.providerId)
  ) {
    throw new Error(
      "Personal connector credential not found or not owned by this user."
    );
  }
  const base = getResolvedToolInputParams({
    configEncrypted: row.configEncrypted,
    credentialId: row.credentialId,
    credentialRow,
  });

  const usingSharedCredential =
    Boolean(credentialRow) &&
    credentialRow?.ownedByUserId != null &&
    credentialRow.ownedByUserId !== args.userId;

  const merged = {
    ...base,
    ...(args.toolInputOverrides ?? {}),
    ...args.input,
    credentialId: row.credentialId,
    userId: args.userId,
  };

  const result = await executeProviderTool(
    args.providerId,
    args.toolId,
    merged
  );
  if (!usingSharedCredential) {
    return result;
  }

  const warning =
    "Warning: this action used a shared connector credential (another user's OAuth identity).";
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return {
      ...(result as Record<string, unknown>),
      sharedCredentialWarning: warning,
    };
  }
  return { result, sharedCredentialWarning: warning };
}

function executeProviderTool(
  providerId: string,
  toolId: string,
  merged: Record<string, unknown>
): Promise<unknown> | unknown {
  if (providerId === GOOGLE_DRIVE_PROVIDER_ID && isGoogleDriveToolId(toolId)) {
    return executeGoogleDrive(toolId, merged);
  }
  if (providerId === GMAIL_PROVIDER_ID && isGmailToolId(toolId)) {
    return executeGmail(toolId, merged);
  }
  if (
    providerId === GOOGLE_CALENDAR_PROVIDER_ID &&
    isGoogleCalendarToolId(toolId)
  ) {
    return executeGoogleCalendar(toolId, merged);
  }
  if (providerId === CONFLUENCE_PROVIDER_ID && isConfluenceToolId(toolId)) {
    return executeConfluence(toolId, merged);
  }
  if (providerId === NOTION_PROVIDER_ID && isNotionToolId(toolId)) {
    return executeNotion(toolId, merged);
  }
  if (providerId === SHAREPOINT_PROVIDER_ID && isSharePointToolId(toolId)) {
    return executeSharePoint(toolId, merged);
  }
  if (providerId === SLACK_PROVIDER_ID && isSlackToolId(toolId)) {
    return executeSlack(toolId, merged);
  }
  if (providerId === JIRA_PROVIDER_ID && isJiraToolId(toolId)) {
    return executeJira(toolId, merged);
  }

  throw new Error(`Unsupported provider: ${providerId}`);
}
