import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { type TeamSource, tenantMembers } from "@/core/lib/db/tables";
import {
  bulkIndexChunks,
  deleteChunksForDocuments,
  hybridSearchChunks,
} from "@/core/lib/search/chunk-index";
import { chunkText } from "@/core/lib/search/chunker";
import { getTenantIndexName } from "@/core/lib/search/config";
import { isNotionDatabaseIndexRef } from "@/core/lib/sources/notion-source-refs";
import { buildKnowledgeItemAccessControlList } from "@/core/lib/sources/source-item-acl";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";
import { isTeamOrPersonalSourceType } from "@/shared/search/source-type-compat";
import type { IndexChunkInput, SearchResultChunk } from "@/shared/search/types";

const db = getDb();
const DEFAULT_SEARCH_DOCUMENT_LIMIT = 12;
const SEARCH_CHUNK_FETCH_MULTIPLIER = 4;

function dedupeChunksByDocument(
  chunks: SearchResultChunk[],
  documentLimit: number
): SearchResultChunk[] {
  const bestChunkByDocumentId = new Map<string, SearchResultChunk>();
  for (const chunk of chunks) {
    const existing = bestChunkByDocumentId.get(chunk.documentId);
    if (!existing || chunk.score > existing.score) {
      bestChunkByDocumentId.set(chunk.documentId, chunk);
    }
  }

  return [...bestChunkByDocumentId.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, documentLimit);
}

function resolveKnowledgeItemAcl(item: TeamSource) {
  if (item.accessControlList.length > 0) {
    return Promise.resolve(item.accessControlList);
  }
  return buildKnowledgeItemAccessControlList(item);
}

function isNotionDatabaseCatalogOnlyItem(item: TeamSource) {
  const externalRef = item.externalRef?.trim();
  if (!externalRef) {
    return false;
  }
  return item.sourceType === "notion" && isNotionDatabaseIndexRef(externalRef);
}

export async function indexTeamKbItemInSearch(item: TeamSource) {
  if (isNotionDatabaseCatalogOnlyItem(item)) {
    await deleteTeamKbItemFromSearch({
      itemId: item.id,
      tenantId: item.tenantId,
    });
    return;
  }

  const indexName = getTenantIndexName(item.tenantId);
  const acl = await resolveKnowledgeItemAcl(item);
  const normalizedContent = item.content?.trim() || item.title.trim();
  const chunked = chunkText(normalizedContent);
  const chunks = (chunked.length > 0 ? chunked : [normalizedContent]).map(
    (content, index) =>
      ({
        accessControlList: acl,
        blurb: content.slice(0, 240),
        chunkIndex: index,
        content,
        documentId: item.id,
        link: item.link ?? "",
        sourceConnectorType: item.sourceType,
        sourceCreatedByUserId: item.createdByUserId,
        sourceExternalRef: item.externalRef,
        sourceType: "team_source",
        sourceVisibility: item.visibility,
        tenantId: item.tenantId,
        title: item.title,
        // Prefer source modified time so recency reflects Drive/Confluence/etc.,
        // not when Kimiro last indexed the row.
        updatedAt: item.sourceUpdatedAt ?? item.updatedAt,
      }) satisfies IndexChunkInput
  );

  // Delete-before-write so shrunk docs don't leave orphan chunks searchable.
  await deleteChunksForDocuments({
    documentIds: [item.id],
    indexName,
    sourceType: "team_source",
    tenantId: item.tenantId,
  });
  await bulkIndexChunks(indexName, chunks);
}

export async function deleteTeamKbItemFromSearch(args: {
  tenantId: string;
  itemId: string;
}) {
  const indexName = getTenantIndexName(args.tenantId);
  await deleteChunksForDocuments({
    documentIds: [args.itemId],
    indexName,
    sourceType: "team_source",
    tenantId: args.tenantId,
  });
}

export async function searchTeamKbInSearch(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  query: string;
  limit?: number;
}): Promise<SearchResultChunk[]> {
  const { teamKb } = await searchIndexedSourcesInSearch(args);
  return teamKb;
}

/** Indexed Slack messages (sourceType slack) visible via mirrored channel ACL. */
export async function searchIndexedSlackInSearch(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  query: string;
  limit?: number;
}): Promise<SearchResultChunk[]> {
  const { slack } = await searchIndexedSourcesInSearch(args);
  return slack;
}

/**
 * One Vespa hybrid query; split into team KB vs indexed Slack for merge.
 */
export async function searchIndexedSourcesInSearch(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  query: string;
  limit?: number;
}): Promise<{ teamKb: SearchResultChunk[]; slack: SearchResultChunk[] }> {
  const tenantMembersRow = await db
    .select({ id: tenantMembers.authUserId })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.userId)
      )
    )
    .limit(1);
  if (tenantMembersRow.length === 0) {
    return { slack: [], teamKb: [] };
  }

  const acl = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  const indexName = getTenantIndexName(args.tenantId);
  const documentLimit = args.limit ?? DEFAULT_SEARCH_DOCUMENT_LIMIT;
  const results = await hybridSearchChunks({
    accessControlList: acl,
    indexName,
    limit: documentLimit * SEARCH_CHUNK_FETCH_MULTIPLIER,
    query: args.query,
    tenantId: args.tenantId,
  });

  const teamKbChunks = results.filter(
    (result) =>
      (isTeamOrPersonalSourceType(result.sourceType) ||
        result.sourceType === "google_drive") &&
      !(
        result.sourceExternalRef &&
        isNotionDatabaseIndexRef(result.sourceExternalRef)
      )
  );
  const slackChunks = results.filter((result) => result.sourceType === "slack");

  return {
    slack: dedupeChunksByDocument(slackChunks, documentLimit),
    teamKb: dedupeChunksByDocument(teamKbChunks, documentLimit),
  };
}
