import { ensureFreshGoogleDriveAccessToken } from "@/core/lib/connectors/providers/google-drive/credential-token";
import {
  type GmailToolId,
  isGmailToolId,
} from "@/shared/connectors/providers/gmail/chat-tools";
import {
  gmailCreateDraft,
  gmailGetMessage,
  gmailGetThread,
  gmailListMessages,
  gmailReplyToMessage,
  gmailSearchMessages,
  gmailSendDraft,
  gmailSendMessage,
} from "./actions";
import { toGmailToolErrorOutput } from "./tool-output";

export type { GmailToolId } from "@/shared/connectors/providers/gmail/chat-tools";
export {
  GMAIL_ACTION_TOOL_IDS,
  GMAIL_TOOL_IDS,
  gmailToolIdsForConnector,
  isGmailToolId,
} from "@/shared/connectors/providers/gmail/chat-tools";

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function optionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
}

export async function executeGmail(
  toolId: GmailToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");

  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Gmail connection context is incomplete." };
  }

  if (!isGmailToolId(toolId)) {
    return { error: `Unsupported Gmail tool: ${toolId}` };
  }

  try {
    const accessToken = await ensureFreshGoogleDriveAccessToken({
      credentialId,
      tenantId,
      userId,
    });

    if (toolId === "gmailListMessages") {
      return await gmailListMessages({
        accessToken,
        labelId: optionalString(merged.labelId),
        maxResults: optionalNumber(merged.maxResults),
        pageToken: optionalString(merged.pageToken),
        tenantId,
      });
    }

    if (toolId === "gmailSearchMessages") {
      return await gmailSearchMessages({
        accessToken,
        maxResults: optionalNumber(merged.maxResults),
        pageToken: optionalString(merged.pageToken),
        query: String(merged.query ?? ""),
        tenantId,
      });
    }

    if (toolId === "gmailGetMessage") {
      return await gmailGetMessage({
        accessToken,
        messageId: String(merged.messageId ?? ""),
        tenantId,
      });
    }

    if (toolId === "gmailGetThread") {
      return await gmailGetThread({
        accessToken,
        maxMessages: optionalNumber(merged.maxMessages),
        tenantId,
        threadId: String(merged.threadId ?? ""),
      });
    }

    if (toolId === "gmailSendMessage") {
      return await gmailSendMessage({
        accessToken,
        bcc: optionalString(merged.bcc),
        body: String(merged.body ?? ""),
        cc: optionalString(merged.cc),
        subject: String(merged.subject ?? ""),
        tenantId,
        to: String(merged.to ?? ""),
      });
    }

    if (toolId === "gmailCreateDraft") {
      return await gmailCreateDraft({
        accessToken,
        bcc: optionalString(merged.bcc),
        body: String(merged.body ?? ""),
        cc: optionalString(merged.cc),
        subject: String(merged.subject ?? ""),
        tenantId,
        threadId: optionalString(merged.threadId),
        to: String(merged.to ?? ""),
      });
    }

    if (toolId === "gmailSendDraft") {
      return await gmailSendDraft({
        accessToken,
        draftId: String(merged.draftId ?? ""),
        tenantId,
      });
    }

    if (toolId === "gmailReplyToMessage") {
      return await gmailReplyToMessage({
        accessToken,
        body: String(merged.body ?? ""),
        messageId: String(merged.messageId ?? ""),
        replyAll: optionalBoolean(merged.replyAll),
        tenantId,
      });
    }

    return { error: `Unsupported Gmail tool: ${toolId}` };
  } catch (error) {
    return toGmailToolErrorOutput(error, tenantSlug);
  }
}
