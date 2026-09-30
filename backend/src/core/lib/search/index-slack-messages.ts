import {
  SlackApiError,
  slackApi,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import { slackListChannelMemberIds } from "@/core/lib/connectors/providers/slack/list-channel-members";
import { normalizeSlackMessagesWithUsers } from "@/core/lib/connectors/providers/slack/slack-messages";
import {
  getTenantSlackIndexStateMap,
  upsertTenantSlackIndexedChannel,
} from "@/core/lib/db/slack-index-state-queries";
import {
  bulkIndexChunks,
  updateAccessControlListForSlackChannel,
} from "@/core/lib/search/chunk-index";
import { chunkText } from "@/core/lib/search/chunker";
import { getTenantIndexName } from "@/core/lib/search/config";
import { buildSlackFederatedTitle } from "@/core/lib/search/federated/slack-title";
import type { SearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import {
  buildSlackChannelAccessControlList,
  slackMessageDocumentId,
} from "@/core/lib/search/slack/external-access";
import type { IndexChunkInput } from "@/shared/search/types";

export type SlackChannelToIndex = {
  id: string;
  name: string;
  isPrivate: boolean;
};

type SlackSkipReason =
  | "private_skipped"
  | "join_error"
  | "acl_empty"
  | "history_error"
  | "no_new_messages";

type SkippedSlackChannel = {
  channelId: string;
  channelName: string;
  reason: SlackSkipReason;
  detail?: string;
};

const HISTORY_PAGE_SIZE = 200;
/** Cap first-run / catch-up volume per channel per run. */
const MAX_MESSAGES_PER_CHANNEL_PER_RUN = 5000;

function blurbFromContent(content: string, maxLength = 240) {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

function slackTsToDate(ts: string): Date {
  const seconds = Number.parseFloat(ts);
  if (!Number.isFinite(seconds)) {
    return new Date();
  }
  return new Date(seconds * 1000);
}

function compareSlackTs(a: string, b: string) {
  const left = Number.parseFloat(a);
  const right = Number.parseFloat(b);
  if (!Number.isFinite(left) && !Number.isFinite(right)) {
    return 0;
  }
  if (!Number.isFinite(left)) {
    return -1;
  }
  if (!Number.isFinite(right)) {
    return 1;
  }
  return left - right;
}

function maxSlackTs(current: string, candidate: string) {
  if (!candidate.trim()) {
    return current;
  }
  if (!current.trim()) {
    return candidate;
  }
  return compareSlackTs(candidate, current) > 0 ? candidate : current;
}

async function ensurePublicChannelMembership(input: {
  accessToken: string;
  channelId: string;
  channelName: string;
}) {
  const info = await slackApi<{
    ok: boolean;
    channel?: {
      id?: string;
      name?: string;
      is_member?: boolean;
      is_private?: boolean;
      is_archived?: boolean;
    };
  }>("conversations.info", input.accessToken, { channel: input.channelId });

  const channel = info.channel;
  if (!channel?.id) {
    throw new SlackApiError("channel_not_found");
  }
  if (channel.is_archived) {
    throw new Error(`Slack channel #${input.channelName} is archived.`);
  }
  if (channel.is_private) {
    throw new Error(
      `Slack channel #${input.channelName} is private; join it in Slack before indexing.`
    );
  }
  if (!channel.is_member) {
    await slackApi("conversations.join", input.accessToken, {
      channel: channel.id,
    });
  }
}

async function loadWorkspaceUserEmails(accessToken: string) {
  const emailsByUserId = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = { limit: "200" };
    if (cursor) {
      params.cursor = cursor;
    }
    const page = await slackApi<{
      ok: boolean;
      members?: Array<{
        id?: string;
        deleted?: boolean;
        is_bot?: boolean;
        profile?: { email?: string };
      }>;
      response_metadata?: { next_cursor?: string };
    }>("users.list", accessToken, params);

    for (const member of page.members ?? []) {
      if (!member.id || member.deleted || member.is_bot) {
        continue;
      }
      const email = member.profile?.email?.trim().toLowerCase();
      if (email?.includes("@")) {
        emailsByUserId.set(member.id, email);
      }
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);

  return emailsByUserId;
}

function fetchChannelHistoryPage(input: {
  accessToken: string;
  channelId: string;
  cursor?: string;
  oldest?: string;
}) {
  const params: Record<string, string> = {
    channel: input.channelId,
    limit: String(HISTORY_PAGE_SIZE),
  };
  if (input.cursor) {
    params.cursor = input.cursor;
  }
  if (input.oldest) {
    params.oldest = input.oldest;
  }

  return slackApi<{
    ok: boolean;
    messages?: Array<{
      type?: string;
      ts?: string;
      user?: string;
      text?: string;
      subtype?: string;
      bot_id?: string;
    }>;
    has_more?: boolean;
    response_metadata?: { next_cursor?: string };
  }>("conversations.history", input.accessToken, params);
}

/**
 * List public (and optionally private) Slack channels for indexing.
 */
export async function listSlackChannelsForIndex(input: {
  tenantId: string;
  accessToken: string;
  includePrivate?: boolean;
  allowlistChannelIds?: Set<string>;
}): Promise<SlackChannelToIndex[]> {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const channels: SlackChannelToIndex[] = [];
  let cursor: string | undefined;
  const types = input.includePrivate
    ? "public_channel,private_channel"
    : "public_channel";

  do {
    const params: Record<string, string> = {
      exclude_archived: "true",
      limit: "200",
      types,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const page = await slackApi<{
      ok: boolean;
      channels?: Array<{
        id?: string;
        name?: string;
        is_private?: boolean;
      }>;
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", input.accessToken, params);

    for (const channel of page.channels ?? []) {
      if (!(channel.id && channel.name)) {
        continue;
      }
      if (
        input.allowlistChannelIds &&
        input.allowlistChannelIds.size > 0 &&
        !input.allowlistChannelIds.has(channel.id)
      ) {
        continue;
      }
      const isPrivate = Boolean(channel.is_private);
      if (isPrivate && !input.includePrivate) {
        continue;
      }
      channels.push({
        id: channel.id,
        isPrivate,
        name: channel.name,
      });
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);

  return channels;
}

export async function indexSlackChannelsForTenant(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  channels: SlackChannelToIndex[];
  settings: SearchRuntimeSettings;
  /** When false, private channels are skipped even if listed. */
  includePrivate?: boolean;
  /** Auth user performing the index (stored for delete ownership). */
  indexedByUserId?: string | null;
}) {
  const indexName = getTenantIndexName(input.tenantId);
  const priorState = await getTenantSlackIndexStateMap(input.tenantId);
  const emailsByUserId = await loadWorkspaceUserEmails(input.accessToken);

  const skippedChannels: SkippedSlackChannel[] = [];
  let indexedDocuments = 0;
  let indexedChunks = 0;
  let unchangedChannels = 0;

  for (const channel of input.channels) {
    if (channel.isPrivate && !input.includePrivate) {
      skippedChannels.push({
        channelId: channel.id,
        channelName: channel.name,
        reason: "private_skipped",
      });
      continue;
    }

    try {
      if (channel.isPrivate) {
        // Private: indexer user must already be a member (no auto-join).
        const info = await slackApi<{
          ok: boolean;
          channel?: { is_member?: boolean };
        }>("conversations.info", input.accessToken, { channel: channel.id });
        if (!info.channel?.is_member) {
          skippedChannels.push({
            channelId: channel.id,
            channelName: channel.name,
            detail: "Not a member of private channel",
            reason: "join_error",
          });
          continue;
        }
      } else {
        await ensurePublicChannelMembership({
          accessToken: input.accessToken,
          channelId: channel.id,
          channelName: channel.name,
        });
      }
    } catch (error) {
      skippedChannels.push({
        channelId: channel.id,
        channelName: channel.name,
        detail: error instanceof Error ? error.message : "Join failed",
        reason: "join_error",
      });
      await upsertTenantSlackIndexedChannel({
        channelId: channel.id,
        channelName: channel.name,
        indexedByUserId: input.indexedByUserId ?? null,
        lastMessageTs: priorState.get(channel.id)?.lastMessageTs ?? "",
        lastStatus: "failed",
        tenantId: input.tenantId,
      });
      continue;
    }

    const memberIds = await slackListChannelMemberIds({
      accessToken: input.accessToken,
      channelId: channel.id,
    });
    const memberEmails = memberIds
      .map((id) => emailsByUserId.get(id))
      .filter((email): email is string => Boolean(email));
    const accessControlList = buildSlackChannelAccessControlList(memberEmails);

    if (accessControlList.length === 0) {
      skippedChannels.push({
        channelId: channel.id,
        channelName: channel.name,
        detail: "No member emails resolved for channel ACL",
        reason: "acl_empty",
      });
      await upsertTenantSlackIndexedChannel({
        channelId: channel.id,
        channelName: channel.name,
        indexedByUserId: input.indexedByUserId ?? null,
        lastMessageTs: priorState.get(channel.id)?.lastMessageTs ?? "",
        lastStatus: "failed",
        tenantId: input.tenantId,
      });
      continue;
    }

    // Refresh ACL on existing chunks every run (leavers/joiners).
    await updateAccessControlListForSlackChannel({
      accessControlList,
      channelId: channel.id,
      indexName,
      tenantId: input.tenantId,
    }).catch(() => undefined);

    const prior = priorState.get(channel.id);
    const oldest =
      prior?.lastStatus === "indexed" && prior.lastMessageTs.trim()
        ? prior.lastMessageTs
        : undefined;

    const rawMessages: Array<{
      type?: string;
      ts?: string;
      user?: string;
      text?: string;
      subtype?: string;
      bot_id?: string;
    }> = [];
    let cursor: string | undefined;
    let historyError: string | undefined;

    try {
      do {
        const page = await fetchChannelHistoryPage({
          accessToken: input.accessToken,
          channelId: channel.id,
          cursor,
          oldest,
        });
        for (const message of page.messages ?? []) {
          rawMessages.push(message);
        }
        if (rawMessages.length >= MAX_MESSAGES_PER_CHANNEL_PER_RUN) {
          break;
        }
        cursor = page.has_more
          ? page.response_metadata?.next_cursor?.trim() || undefined
          : undefined;
      } while (cursor);
    } catch (error) {
      historyError =
        error instanceof Error ? error.message : "History fetch failed";
    }

    if (historyError) {
      skippedChannels.push({
        channelId: channel.id,
        channelName: channel.name,
        detail: historyError,
        reason: "history_error",
      });
      await upsertTenantSlackIndexedChannel({
        channelId: channel.id,
        channelName: channel.name,
        indexedByUserId: input.indexedByUserId ?? null,
        lastMessageTs: prior?.lastMessageTs ?? "",
        lastStatus: "failed",
        tenantId: input.tenantId,
      });
      continue;
    }

    const indexable = rawMessages.filter((message) => {
      if (message.bot_id || message.subtype) {
        return false;
      }
      if ((message.type ?? "message") !== "message") {
        return false;
      }
      const ts = message.ts?.trim();
      if (!ts) {
        return false;
      }
      // Skip the checkpoint message on incremental runs.
      if (oldest && ts === oldest) {
        return false;
      }
      return Boolean(message.text?.trim());
    });

    if (indexable.length === 0) {
      unchangedChannels += 1;
      await upsertTenantSlackIndexedChannel({
        channelId: channel.id,
        channelName: channel.name,
        indexedByUserId: input.indexedByUserId ?? null,
        lastMessageTs: prior?.lastMessageTs ?? oldest ?? "",
        lastStatus: "indexed",
        tenantId: input.tenantId,
      });
      continue;
    }

    const normalized = await normalizeSlackMessagesWithUsers({
      accessToken: input.accessToken,
      channelId: channel.id,
      messages: indexable,
      teamUrl: input.teamUrl,
    });

    const chunks: IndexChunkInput[] = [];
    let newestTs = prior?.lastMessageTs ?? "";

    for (const message of normalized) {
      const ts = message.ts?.trim();
      if (!ts) {
        continue;
      }
      newestTs = maxSlackTs(newestTs, ts);
      const text = message.text.trim() || "(empty message)";
      const title = buildSlackFederatedTitle({
        channelName: channel.name,
        text,
        userName: message.userName,
      });
      const headerParts = [
        title ? `Source: ${title}` : null,
        message.userName ? `From: ${message.userName}` : null,
      ].filter(Boolean);
      const contentBody =
        headerParts.length > 0 ? `${headerParts.join(" · ")}\n${text}` : text;
      const textChunks = chunkText(contentBody);
      const documentId = slackMessageDocumentId(channel.id, ts);
      const updatedAt = slackTsToDate(ts);

      for (const [chunkIndex, chunkContent] of (textChunks.length > 0
        ? textChunks
        : [contentBody]
      ).entries()) {
        chunks.push({
          accessControlList,
          blurb: blurbFromContent(chunkContent),
          chunkIndex,
          content: chunkContent,
          documentId,
          link: message.permalink?.trim() ?? "",
          sourceType: "slack",
          tenantId: input.tenantId,
          title,
          updatedAt,
        });
      }
    }

    if (chunks.length === 0) {
      unchangedChannels += 1;
      await upsertTenantSlackIndexedChannel({
        channelId: channel.id,
        channelName: channel.name,
        indexedByUserId: input.indexedByUserId ?? null,
        lastMessageTs: newestTs || prior?.lastMessageTs || "",
        lastStatus: "indexed",
        tenantId: input.tenantId,
      });
      continue;
    }

    const batchSize = 32;
    for (let offset = 0; offset < chunks.length; offset += batchSize) {
      const batch = chunks.slice(offset, offset + batchSize);
      const result = await bulkIndexChunks(indexName, batch, input.settings);
      indexedChunks += result.indexed;
    }
    indexedDocuments += new Set(chunks.map((chunk) => chunk.documentId)).size;

    await upsertTenantSlackIndexedChannel({
      channelId: channel.id,
      channelName: channel.name,
      indexedByUserId: input.indexedByUserId ?? null,
      lastMessageTs: newestTs,
      lastStatus: "indexed",
      tenantId: input.tenantId,
    });
  }

  return {
    indexedChunks,
    indexedDocuments,
    listedChannels: input.channels.length,
    skippedChannels: skippedChannels.length,
    skippedSamples: skippedChannels.slice(0, 20),
    unchangedChannels,
  };
}
