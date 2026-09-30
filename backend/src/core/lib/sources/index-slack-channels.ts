import { getTenantSearchRuntimeSettings } from "@/core/lib/db/search-index-queries";
import {
  deleteTenantSlackIndexedChannels,
  filterSlackChannelsRemovableByUser,
  getTenantSlackIndexStateMap,
} from "@/core/lib/db/slack-index-state-queries";
import { deleteChunksForSlackChannel } from "@/core/lib/search/chunk-index";
import {
  getTenantIndexName,
  isIndexingEnabled,
} from "@/core/lib/search/config";
import {
  indexSlackChannelsForTenant,
  listSlackChannelsForIndex,
  type SlackChannelToIndex,
} from "@/core/lib/search/index-slack-messages";
import { getSlackAccessForUser } from "@/core/lib/sources/slack-access";

export type IndexSlackChannelResult = {
  channelId: string;
  ok: boolean;
  error?: string;
};

export async function indexSlackChannelsToKb(args: {
  tenantId: string;
  userId: string;
  channelIds: string[];
}): Promise<{
  ok: boolean;
  error?: string;
  results: IndexSlackChannelResult[];
}> {
  const settings = await getTenantSearchRuntimeSettings(args.tenantId);
  if (!isIndexingEnabled(settings)) {
    return {
      error: "Indexing is disabled for this tenant.",
      ok: false,
      results: [],
    };
  }

  const access = await getSlackAccessForUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!access.ok) {
    return { error: access.error, ok: false, results: [] };
  }

  const wanted = new Set(
    args.channelIds.map((id) => id.trim()).filter(Boolean)
  );
  if (wanted.size === 0) {
    return { error: "No channels selected.", ok: false, results: [] };
  }

  const listed = await listSlackChannelsForIndex({
    accessToken: access.accessToken,
    allowlistChannelIds: wanted,
    includePrivate: true,
    tenantId: args.tenantId,
  });

  const foundIds = new Set(listed.map((channel) => channel.id));
  const results: IndexSlackChannelResult[] = [];
  for (const channelId of wanted) {
    if (!foundIds.has(channelId)) {
      results.push({
        channelId,
        error: "Channel not found or not accessible.",
        ok: false,
      });
    }
  }

  if (listed.length === 0) {
    return {
      error: "No accessible Slack channels matched the selection.",
      ok: false,
      results,
    };
  }

  const indexResult = await indexSlackChannelsForTenant({
    accessToken: access.accessToken,
    channels: listed,
    includePrivate: true,
    indexedByUserId: args.userId,
    settings,
    teamUrl: access.teamUrl,
    tenantId: args.tenantId,
  });

  const skippedById = new Map(
    indexResult.skippedSamples.map((sample) => [sample.channelId, sample])
  );

  for (const channel of listed) {
    const skipped = skippedById.get(channel.id);
    if (skipped && skipped.reason !== "no_new_messages") {
      results.push({
        channelId: channel.id,
        error: skipped.detail ?? skipped.reason,
        ok: false,
      });
      continue;
    }
    results.push({ channelId: channel.id, ok: true });
  }

  const anyOk = results.some((result) => result.ok);
  return {
    error: anyOk ? undefined : "Failed to index selected Slack channels.",
    ok: anyOk,
    results,
  };
}

export async function removeSlackChannelsFromKb(args: {
  tenantId: string;
  channelIds: string[];
  userId: string;
  isAdmin: boolean;
}): Promise<{ ok: boolean; error?: string; removedChannelIds?: string[] }> {
  const channelIds = [
    ...new Set(args.channelIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (channelIds.length === 0) {
    return { error: "No channels selected.", ok: false };
  }

  const removable = await filterSlackChannelsRemovableByUser({
    channelIds,
    isAdmin: args.isAdmin,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (removable.length === 0) {
    return {
      error:
        "You can only remove Slack channels you indexed (or ask an admin).",
      ok: false,
    };
  }

  const indexName = getTenantIndexName(args.tenantId);
  for (const channelId of removable) {
    await deleteChunksForSlackChannel({
      channelId,
      indexName,
      tenantId: args.tenantId,
    });
  }
  await deleteTenantSlackIndexedChannels({
    channelIds: removable,
    tenantId: args.tenantId,
  });
  return { ok: true, removedChannelIds: removable };
}

/** CLI backfill: reindex channels previously selected in Knowledge. */
export async function reindexSelectedSlackChannels(args: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  settings: Awaited<ReturnType<typeof getTenantSearchRuntimeSettings>>;
}) {
  const state = await getTenantSlackIndexStateMap(args.tenantId);
  const channelIds = [...state.keys()];
  if (channelIds.length === 0) {
    return {
      indexedChunks: 0,
      indexedDocuments: 0,
      listedChannels: 0,
      skippedChannels: 0,
      skippedSamples: [],
      unchangedChannels: 0,
    };
  }

  const listed = await listSlackChannelsForIndex({
    accessToken: args.accessToken,
    allowlistChannelIds: new Set(channelIds),
    includePrivate: true,
    tenantId: args.tenantId,
  });

  // Keep state-only channels that disappeared from Slack list as skipped.
  const channels: SlackChannelToIndex[] = listed;
  return indexSlackChannelsForTenant({
    accessToken: args.accessToken,
    channels,
    includePrivate: true,
    settings: args.settings,
    teamUrl: args.teamUrl,
    tenantId: args.tenantId,
  });
}
