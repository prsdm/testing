import { SLACK_TOOL_IDS } from "@/core/lib/connectors/providers/slack/chat-tools";
import { connectUrlIfAuthError } from "@/shared/connectors/connect-on-auth-error";

export { slackToolIdsForConnector } from "@/core/lib/connectors/providers/slack/chat-tools";

import { slackCreateChannel } from "@/core/lib/connectors/providers/slack/create-channel";
import { ensureFreshSlackAccessToken } from "@/core/lib/connectors/providers/slack/credential-token";
import { slackGetConversationHistory } from "@/core/lib/connectors/providers/slack/get-conversation-history";
import { slackGetDirectMessageHistory } from "@/core/lib/connectors/providers/slack/get-direct-message-history";
import { slackGetThreadReplies } from "@/core/lib/connectors/providers/slack/get-thread-replies";
import { slackListChannels } from "@/core/lib/connectors/providers/slack/list-channels";
import { slackListUsers } from "@/core/lib/connectors/providers/slack/list-users";
import { slackPostDirectMessage } from "@/core/lib/connectors/providers/slack/post-direct-message";
import { slackPostMessage } from "@/core/lib/connectors/providers/slack/post-message";
import { slackSearchMessages } from "@/core/lib/connectors/providers/slack/search-messages";
import { pickThreadTsFromInput } from "@/core/lib/connectors/providers/slack/thread-input";
import { slackUpdateMessage } from "@/core/lib/connectors/providers/slack/update-message";

export type SlackToolId = (typeof SLACK_TOOL_IDS)[number];

export function isSlackToolId(toolId: string): toolId is SlackToolId {
  return (SLACK_TOOL_IDS as readonly string[]).includes(toolId);
}

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

function slackContext(merged: Record<string, unknown>) {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");
  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Slack connection context is incomplete." as const };
  }
  return { credentialId, tenantId, tenantSlug, userId };
}

export async function executeSlack(
  toolId: SlackToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const context = slackContext(merged);
  if ("error" in context) {
    return context;
  }
  if (!isSlackToolId(toolId)) {
    return { error: `Unsupported Slack tool: ${toolId}` };
  }

  try {
    const token = await ensureFreshSlackAccessToken({
      credentialId: context.credentialId,
      tenantId: context.tenantId,
      userId: context.userId,
    });

    if (toolId === "slackListChannels") {
      return await slackListChannels({
        accessToken: token.accessToken,
        cursor: optionalString(merged.cursor),
        limit: optionalNumber(merged.limit),
        tenantId: context.tenantId,
      });
    }

    if (toolId === "slackListUsers") {
      return await slackListUsers({
        accessToken: token.accessToken,
        cursor: optionalString(merged.cursor),
        tenantId: context.tenantId,
      });
    }

    if (toolId === "slackSearchMessages") {
      return await slackSearchMessages({
        accessToken: token.accessToken,
        count: optionalNumber(merged.count),
        query: String(merged.query ?? ""),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
      });
    }

    if (toolId === "slackGetConversationHistory") {
      return await slackGetConversationHistory({
        accessToken: token.accessToken,
        channelId: optionalString(merged.channelId),
        channelName: optionalString(merged.channelName),
        cursor: optionalString(merged.cursor),
        latest: optionalString(merged.latest),
        limit: optionalNumber(merged.limit),
        oldest: optionalString(merged.oldest),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
      });
    }

    if (toolId === "slackGetDirectMessageHistory") {
      const user =
        optionalString(merged.user) ??
        optionalString(merged.userName) ??
        optionalString(merged.userEmail) ??
        optionalString(merged.slackUserId);
      return await slackGetDirectMessageHistory({
        accessToken: token.accessToken,
        cursor: optionalString(merged.cursor),
        latest: optionalString(merged.latest),
        limit: optionalNumber(merged.limit),
        oldest: optionalString(merged.oldest),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
        user: user ?? "",
      });
    }

    if (toolId === "slackGetThreadReplies") {
      return await slackGetThreadReplies({
        accessToken: token.accessToken,
        channelId: optionalString(merged.channelId),
        channelName: optionalString(merged.channelName),
        cursor: optionalString(merged.cursor),
        limit: optionalNumber(merged.limit),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
        threadTs: pickThreadTsFromInput(merged) ?? "",
      });
    }

    if (toolId === "slackPostMessage") {
      return await slackPostMessage({
        accessToken: token.accessToken,
        channelId: optionalString(merged.channelId),
        channelName: optionalString(merged.channelName),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
        text: String(merged.text ?? ""),
      });
    }

    if (toolId === "slackPostDirectMessage") {
      const user =
        optionalString(merged.user) ??
        optionalString(merged.userName) ??
        optionalString(merged.userEmail) ??
        optionalString(merged.slackUserId);
      return await slackPostDirectMessage({
        accessToken: token.accessToken,
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
        text: String(merged.text ?? ""),
        user: user ?? "",
      });
    }

    if (toolId === "slackUpdateMessage") {
      return await slackUpdateMessage({
        accessToken: token.accessToken,
        channelId: optionalString(merged.channelId),
        channelName: optionalString(merged.channelName),
        messageTs: String(merged.messageTs ?? ""),
        teamUrl: token.teamUrl,
        tenantId: context.tenantId,
        text: String(merged.text ?? ""),
      });
    }

    if (toolId === "slackCreateChannel") {
      return await slackCreateChannel({
        accessToken: token.accessToken,
        isPrivate: optionalBoolean(merged.isPrivate),
        name: String(merged.name ?? ""),
        tenantId: context.tenantId,
      });
    }

    return { error: `Unsupported Slack tool: ${toolId}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Slack action failed.",
      ...connectUrlIfAuthError({ error }),
    };
  }
}
