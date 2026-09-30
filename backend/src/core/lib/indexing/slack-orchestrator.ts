import { ensureFreshSlackAccessToken } from "@/core/lib/connectors/providers/slack/credential-token";
import { findSlackIndexingCredentialForTenant } from "@/core/lib/db/connector-queries";
import { getTenantBySlug } from "@/core/lib/db/queries";
import {
  completeIndexRun,
  createIndexRun,
  getTenantSearchRuntimeSettings,
} from "@/core/lib/db/search-index-queries";
import { isIndexingEnabled } from "@/core/lib/search/config";
import { reindexSelectedSlackChannels } from "@/core/lib/sources/index-slack-channels";

/**
 * Ops backfill: reindex Slack channels already selected on the Knowledge page.
 * Does not crawl the whole workspace — selection stays user-driven.
 */
export async function runTenantSlackIndexBySlug(
  tenantSlug: string,
  options?: { preferredUserId?: string }
) {
  const tenant = await getTenantBySlug(tenantSlug);
  if (tenant?.status !== "active") {
    throw new Error(`Active tenant not found: ${tenantSlug}`);
  }

  const settings = await getTenantSearchRuntimeSettings(tenant.id);
  if (!isIndexingEnabled(settings)) {
    throw new Error("Indexing is disabled for this tenant.");
  }

  const indexingCred = await findSlackIndexingCredentialForTenant({
    preferredUserId: options?.preferredUserId,
    tenantId: tenant.id,
  });
  if (!indexingCred) {
    throw new Error(
      "No active Slack OAuth credential found for this tenant. Connect Slack first."
    );
  }

  const token = await ensureFreshSlackAccessToken({
    credentialId: indexingCred.credentialId,
    tenantId: tenant.id,
    userId: indexingCred.userId,
  });

  const run = await createIndexRun(tenant.id);
  try {
    const result = await reindexSelectedSlackChannels({
      accessToken: token.accessToken,
      settings,
      teamUrl: token.teamUrl,
      tenantId: tenant.id,
    });

    const status =
      result.indexedDocuments > 0 || result.unchangedChannels > 0
        ? ("success" as const)
        : ("partial" as const);

    await completeIndexRun({
      chunksIndexed: result.indexedChunks,
      documentsIndexed: result.indexedDocuments,
      metadata: {
        channelsListed: result.listedChannels,
        channelsSkipped: result.skippedChannels,
        channelsUnchanged: result.unchangedChannels,
        indexingUserId: indexingCred.userId,
        mode: "knowledge_selected_channels",
        skippedSamples: result.skippedSamples,
        source: "slack",
        teamName: indexingCred.teamName,
      },
      runId: run.id,
      status,
    });

    return {
      chunksIndexed: result.indexedChunks,
      documentsIndexed: result.indexedDocuments,
      listedChannels: result.listedChannels,
      runId: run.id,
      skippedChannels: result.skippedChannels,
      skippedSamples: result.skippedSamples,
      unchangedChannels: result.unchangedChannels,
    };
  } catch (error) {
    await completeIndexRun({
      chunksIndexed: 0,
      documentsIndexed: 0,
      errorMessage:
        error instanceof Error ? error.message : "Slack index failed",
      errorsCount: 1,
      runId: run.id,
      status: "failed",
    });
    throw error;
  }
}
