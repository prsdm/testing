import type {
  DocumentSourceType,
  IndexChunkInput,
} from "@/shared/search/types";
import {
  encodeVespaDocumentId,
  getChunkDocumentId,
  getDefaultEmbeddingDimension,
  INDEX_FIELDS,
  VESPA_DOCUMENT_TYPE,
  VESPA_NAMESPACE,
} from "../chunk-fields";
import { DEFAULT_CHUNK_SIZE } from "../constants";
import { embedTexts } from "../embeddings";
import type { SearchRuntimeSettings } from "../runtime-settings";
import { envSearchRuntimeSettings } from "../runtime-settings";
import { vespaFetch } from "./client";
import { ensureVespaApplication } from "./deploy";

function normalizeUpdatedAt(value: Date | string | number | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }
  return Date.now();
}

function tensorFromVector(vector: number[]) {
  return vector;
}

function zeroVector(dimension: number) {
  return tensorFromVector(Array.from({ length: dimension }, () => 0));
}

async function embedUniqueTitles(
  chunks: IndexChunkInput[],
  settings: SearchRuntimeSettings
) {
  const uniqueTitles = [
    ...new Set(chunks.map((chunk) => chunk.title.trim()).filter(Boolean)),
  ];
  if (uniqueTitles.length === 0) {
    return new Map<string, number[]>();
  }

  const titleEmbeddings = await embedTexts(uniqueTitles, "passage", settings);
  const titleEmbedMap = new Map<string, number[]>();
  for (let index = 0; index < uniqueTitles.length; index += 1) {
    const title = uniqueTitles[index];
    const embedding = titleEmbeddings[index];
    if (title && embedding) {
      titleEmbedMap.set(title, embedding);
    }
  }
  return titleEmbedMap;
}

function chunkToVespaFields(
  chunk: IndexChunkInput,
  contentVector: number[],
  titleVector: number[] | undefined,
  settings: SearchRuntimeSettings
) {
  const trimmedTitle = chunk.title.trim();
  const resolvedTitleVector =
    titleVector && titleVector.length === settings.embeddingDimension
      ? titleVector
      : zeroVector(settings.embeddingDimension);

  const fields: Record<string, unknown> = {
    [INDEX_FIELDS.tenantId]: chunk.tenantId,
    [INDEX_FIELDS.documentId]: chunk.documentId,
    [INDEX_FIELDS.chunkIndex]: chunk.chunkIndex,
    [INDEX_FIELDS.title]: chunk.title,
    [INDEX_FIELDS.content]: chunk.content,
    [INDEX_FIELDS.blurb]: chunk.blurb,
    [INDEX_FIELDS.link]: chunk.link,
    [INDEX_FIELDS.sourceType]: chunk.sourceType,
    [INDEX_FIELDS.accessControlList]: chunk.accessControlList,
    [INDEX_FIELDS.lastUpdated]: normalizeUpdatedAt(chunk.updatedAt),
    [INDEX_FIELDS.contentVector]: tensorFromVector(contentVector),
    [INDEX_FIELDS.titleVector]: tensorFromVector(resolvedTitleVector),
  };

  if (chunk.sourceConnectorType) {
    fields[INDEX_FIELDS.sourceConnectorType] = chunk.sourceConnectorType;
  }
  if (chunk.sourceVisibility) {
    fields[INDEX_FIELDS.sourceVisibility] = chunk.sourceVisibility;
  }
  if (chunk.sourceExternalRef) {
    fields[INDEX_FIELDS.sourceExternalRef] = chunk.sourceExternalRef;
  }
  if (chunk.sourceCreatedByUserId) {
    fields[INDEX_FIELDS.sourceCreatedByUserId] = chunk.sourceCreatedByUserId;
  }

  if (!trimmedTitle) {
    fields[INDEX_FIELDS.title] = "";
  }

  return fields;
}

export async function ensureChunkIndex(
  _indexName: string,
  _embeddingDimension: number
) {
  await ensureVespaApplication();
}

export async function bulkIndexChunks(
  _indexName: string,
  chunks: IndexChunkInput[],
  settings: SearchRuntimeSettings = envSearchRuntimeSettings()
) {
  if (chunks.length === 0) {
    return { indexed: 0 };
  }

  await ensureChunkIndex(_indexName, settings.embeddingDimension);

  const [embeddings, titleEmbedMap] = await Promise.all([
    embedTexts(
      chunks.map((chunk) => chunk.content),
      "passage",
      settings
    ),
    embedUniqueTitles(chunks, settings),
  ]);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = embeddings[index];
    if (!embedding || embedding.length !== settings.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch for document ${chunk.documentId}`
      );
    }

    const docId = encodeVespaDocumentId(
      getChunkDocumentId(chunk.documentId, chunk.chunkIndex, DEFAULT_CHUNK_SIZE)
    );
    const trimmedTitle = chunk.title.trim();
    const titleVector = trimmedTitle
      ? titleEmbedMap.get(trimmedTitle)
      : undefined;
    const fields = chunkToVespaFields(chunk, embedding, titleVector, settings);

    const response = await vespaFetch(
      `/document/v1/${VESPA_NAMESPACE}/${VESPA_DOCUMENT_TYPE}/docid/${docId}`,
      {
        body: JSON.stringify({ fields }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vespa document feed failed for ${docId}: ${body}`);
    }
  }

  return { indexed: chunks.length };
}

function escapeYqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildTenantSourceSelection(
  tenantId: string,
  sourceType: DocumentSourceType
) {
  const docType = VESPA_DOCUMENT_TYPE;
  const tenantClause = `${docType}.${INDEX_FIELDS.tenantId} == "${escapeYqlString(tenantId)}"`;
  const legacyAlias = legacySourceTypeAlias(sourceType);
  const sourceClause = legacyAlias
    ? `(${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(sourceType)}" or ${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(legacyAlias)}")`
    : `${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(sourceType)}"`;
  return `${tenantClause} and ${sourceClause}`;
}

function legacySourceTypeAlias(sourceType: DocumentSourceType) {
  if (sourceType === "team_source") {
    return "team_kb";
  }
  if (sourceType === "personal_source") {
    return "personal_kb";
  }
  return null;
}

function buildDocumentSelection(input: {
  tenantId: string;
  sourceType: DocumentSourceType;
  documentIds: string[];
}) {
  const docType = VESPA_DOCUMENT_TYPE;
  const tenantClause = `${docType}.${INDEX_FIELDS.tenantId} == "${escapeYqlString(input.tenantId)}"`;
  const legacyAlias = legacySourceTypeAlias(input.sourceType);
  const sourceClause = legacyAlias
    ? `(${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(input.sourceType)}" or ${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(legacyAlias)}")`
    : `${docType}.${INDEX_FIELDS.sourceType} == "${escapeYqlString(input.sourceType)}"`;
  const documentClause =
    input.documentIds.length === 1
      ? `${docType}.${INDEX_FIELDS.documentId} == "${escapeYqlString(input.documentIds[0] ?? "")}"`
      : `(${input.documentIds
          .map(
            (documentId) =>
              `${docType}.${INDEX_FIELDS.documentId} == "${escapeYqlString(documentId)}"`
          )
          .join(" or ")})`;
  return `${tenantClause} and ${sourceClause} and ${documentClause}`;
}

async function deleteBySelection(selection: string) {
  const response = await vespaFetch(
    `/document/v1/${VESPA_NAMESPACE}/${VESPA_DOCUMENT_TYPE}/docid?selection=${encodeURIComponent(selection)}&cluster=kimi_content`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vespa delete failed: ${body}`);
  }

  const payload = (await response.json()) as { documentCount?: number };
  return { deleted: payload.documentCount ?? 0 };
}

/**
 * Re-stamp access_control_list on all indexed Slack messages for a channel.
 * Keeps leavers/joiners in sync without a full channel wipe/reindex.
 */
export async function updateAccessControlListForSlackChannel(input: {
  indexName: string;
  tenantId: string;
  channelId: string;
  accessControlList: string[];
}) {
  await ensureChunkIndex(input.indexName, getDefaultEmbeddingDimension());

  const docType = VESPA_DOCUMENT_TYPE;
  const channelId = input.channelId.trim();
  const escapedChannel = escapeYqlString(channelId).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const selection = [
    `${docType}.${INDEX_FIELDS.tenantId} == "${escapeYqlString(input.tenantId)}"`,
    `${docType}.${INDEX_FIELDS.sourceType} == "slack"`,
    `${docType}.${INDEX_FIELDS.documentId} matches "^slack:${escapedChannel}:"`,
  ].join(" and ");

  const response = await vespaFetch(
    `/document/v1/${VESPA_NAMESPACE}/${VESPA_DOCUMENT_TYPE}/docid?selection=${encodeURIComponent(selection)}&cluster=kimi_content`,
    {
      body: JSON.stringify({
        fields: {
          [INDEX_FIELDS.accessControlList]: {
            assign: input.accessControlList,
          },
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vespa Slack ACL update failed: ${body}`);
  }

  const payload = (await response.json()) as { documentCount?: number };
  return { updated: payload.documentCount ?? 0 };
}

export async function deleteChunksForTenantSource(input: {
  indexName: string;
  tenantId: string;
  sourceType: DocumentSourceType;
}) {
  await ensureChunkIndex(input.indexName, getDefaultEmbeddingDimension());
  const selection = buildTenantSourceSelection(
    input.tenantId,
    input.sourceType
  );
  return deleteBySelection(selection);
}

export async function deleteChunksForDocuments(input: {
  indexName: string;
  tenantId: string;
  sourceType: DocumentSourceType;
  documentIds: string[];
}) {
  if (input.documentIds.length === 0) {
    return { deleted: 0 };
  }

  await ensureChunkIndex(input.indexName, getDefaultEmbeddingDimension());

  const selection = buildDocumentSelection(input);

  return deleteBySelection(selection);
}

/** Delete all indexed Slack message chunks for a channel (documentId prefix). */
export async function deleteChunksForSlackChannel(input: {
  indexName: string;
  tenantId: string;
  channelId: string;
}) {
  await ensureChunkIndex(input.indexName, getDefaultEmbeddingDimension());
  const docType = VESPA_DOCUMENT_TYPE;
  const channelId = input.channelId.trim();
  const escapedChannel = escapeYqlString(channelId).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
  const selection = [
    `${docType}.${INDEX_FIELDS.tenantId} == "${escapeYqlString(input.tenantId)}"`,
    `${docType}.${INDEX_FIELDS.sourceType} == "slack"`,
    `${docType}.${INDEX_FIELDS.documentId} matches "^slack:${escapedChannel}:"`,
  ].join(" and ");
  return deleteBySelection(selection);
}
