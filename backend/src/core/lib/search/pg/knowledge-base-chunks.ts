import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { formatPgVector } from "@/core/lib/db/pg-vector";
import { sourceChunks } from "@/core/lib/db/tables";
import { embedTexts } from "@/core/lib/search/embeddings";
import { weightedReciprocalRankFusion } from "@/core/lib/search/rrf";
import type { SearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import { envSearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import type { SearchResultChunk } from "@/shared/search/types";

export type KnowledgeBaseChunkInput = {
  tenantId: string;
  knowledgeBaseId: string;
  sourceItemId: string;
  chunkIndex: number;
  title: string;
  content: string;
  blurb: string;
  link: string;
  accessControlList: string[];
  sourceConnectorType?: string | null;
  updatedAt?: Date;
};

export async function deleteKnowledgeBaseSourceChunks(args: {
  knowledgeBaseId: string;
  sourceItemId: string;
}) {
  const db = getDb();
  await db
    .delete(sourceChunks)
    .where(
      and(
        eq(sourceChunks.knowledgeBaseId, args.knowledgeBaseId),
        eq(sourceChunks.sourceItemId, args.sourceItemId)
      )
    );
}

export async function deleteKnowledgeBaseChunks(args: {
  knowledgeBaseId: string;
}) {
  const db = getDb();
  await db
    .delete(sourceChunks)
    .where(eq(sourceChunks.knowledgeBaseId, args.knowledgeBaseId));
}

export async function bulkIndexKnowledgeBaseChunks(
  chunks: KnowledgeBaseChunkInput[],
  settings?: SearchRuntimeSettings
) {
  if (chunks.length === 0) {
    return;
  }

  const resolvedSettings = settings ?? envSearchRuntimeSettings();
  const contents = chunks.map((chunk) => chunk.content);
  const titles = chunks.map((chunk) => chunk.title);
  const contentEmbeddings = await embedTexts(
    contents,
    "passage",
    resolvedSettings
  );
  const titleEmbeddings = await embedTexts(titles, "passage", resolvedSettings);
  const db = getDb();

  for (const [index, chunk] of chunks.entries()) {
    const contentEmbedding = contentEmbeddings.at(index);
    const titleEmbedding = titleEmbeddings.at(index);
    if (!contentEmbedding) {
      continue;
    }

    await db
      .insert(sourceChunks)
      .values({
        accessControlList: chunk.accessControlList,
        blurb: chunk.blurb,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentEmbedding,
        knowledgeBaseId: chunk.knowledgeBaseId,
        link: chunk.link,
        sourceConnectorType: chunk.sourceConnectorType ?? null,
        sourceItemId: chunk.sourceItemId,
        tenantId: chunk.tenantId,
        title: chunk.title,
        titleEmbedding: titleEmbedding ?? null,
        updatedAt: chunk.updatedAt ?? new Date(),
      })
      .onConflictDoUpdate({
        set: {
          accessControlList: chunk.accessControlList,
          blurb: chunk.blurb,
          content: chunk.content,
          contentEmbedding,
          link: chunk.link,
          sourceConnectorType: chunk.sourceConnectorType ?? null,
          title: chunk.title,
          titleEmbedding: titleEmbedding ?? null,
          updatedAt: chunk.updatedAt ?? new Date(),
        },
        target: [
          sourceChunks.knowledgeBaseId,
          sourceChunks.sourceItemId,
          sourceChunks.chunkIndex,
        ],
      });
  }
}

type PgChunkRow = {
  document_id: string;
  chunk_index: number;
  title: string;
  content: string;
  blurb: string;
  link: string;
  source_connector_type: string | null;
  source_external_ref: string | null;
  updated_at: Date | string | null;
  score: number;
};

function mapConnectorType(raw: string | null) {
  if (
    raw === "manual" ||
    raw === "drive" ||
    raw === "upload" ||
    raw === "confluence" ||
    raw === "notion" ||
    raw === "sharepoint" ||
    raw === "slack"
  ) {
    return raw;
  }
}

function mapPgRowToSearchResult(row: PgChunkRow): SearchResultChunk {
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at
        ? new Date(row.updated_at).toISOString()
        : undefined;

  return {
    blurb: row.blurb,
    chunkIndex: row.chunk_index,
    content: row.content,
    documentId: row.document_id,
    link: row.link,
    score: Number(row.score),
    sourceConnectorType: mapConnectorType(row.source_connector_type),
    sourceExternalRef: row.source_external_ref,
    sourceType: "team_source",
    sourceVisibility: "private",
    title: row.title,
    updatedAt,
  };
}

function chunkResultId(chunk: SearchResultChunk) {
  return `${chunk.documentId}:${chunk.chunkIndex}`;
}

export async function hybridSearchKnowledgeBaseChunks(args: {
  tenantId: string;
  knowledgeBaseId: string;
  query: string;
  limit?: number;
  settings?: SearchRuntimeSettings;
}): Promise<SearchResultChunk[]> {
  const settings = args.settings ?? envSearchRuntimeSettings();
  const limit = args.limit ?? settings.searchLimit;
  const fetchLimit = Math.max(limit * 4, 40);
  const queryVector = (await embedTexts([args.query], "query", settings)).at(0);
  if (!queryVector) {
    return [];
  }

  const db = getDb();
  const vectorLiteral = formatPgVector(queryVector);

  const vectorResult = await db.execute(sql`
    SELECT
      sc."sourceItemId" AS document_id,
      sc."chunkIndex" AS chunk_index,
      sc.title,
      sc.content,
      sc.blurb,
      sc.link,
      sc."sourceConnectorType" AS source_connector_type,
      ts."externalRef" AS source_external_ref,
      sc."updatedAt" AS updated_at,
      1 - (sc."contentEmbedding" <=> ${vectorLiteral}::vector) AS score
    FROM "SourceChunk" sc
    LEFT JOIN "TeamSource" ts ON ts.id = sc."sourceItemId"
    WHERE sc."tenantId" = ${args.tenantId}::uuid
      AND sc."knowledgeBaseId" = ${args.knowledgeBaseId}::uuid
    ORDER BY sc."contentEmbedding" <=> ${vectorLiteral}::vector
    LIMIT ${fetchLimit}
  `);

  const keywordResult = await db.execute(sql`
    SELECT
      sc."sourceItemId" AS document_id,
      sc."chunkIndex" AS chunk_index,
      sc.title,
      sc.content,
      sc.blurb,
      sc.link,
      sc."sourceConnectorType" AS source_connector_type,
      ts."externalRef" AS source_external_ref,
      sc."updatedAt" AS updated_at,
      ts_rank(sc.search_text, plainto_tsquery('english', ${args.query})) AS score
    FROM "SourceChunk" sc
    LEFT JOIN "TeamSource" ts ON ts.id = sc."sourceItemId"
    WHERE sc."tenantId" = ${args.tenantId}::uuid
      AND sc."knowledgeBaseId" = ${args.knowledgeBaseId}::uuid
      AND sc.search_text @@ plainto_tsquery('english', ${args.query})
    ORDER BY score DESC
    LIMIT ${fetchLimit}
  `);

  const vectorRows = vectorResult as unknown as PgChunkRow[];
  const keywordRows = keywordResult as unknown as PgChunkRow[];

  const merged = weightedReciprocalRankFusion({
    idExtractor: chunkResultId,
    rankedResults: [
      vectorRows.map(mapPgRowToSearchResult),
      keywordRows.map(mapPgRowToSearchResult),
    ],
    weights: [1, 1],
  });

  return merged.slice(0, limit);
}

export async function listKnowledgeBaseChunksForSourceItems(args: {
  tenantId: string;
  knowledgeBaseId: string;
  sourceItemIds: string[];
}): Promise<SearchResultChunk[]> {
  if (args.sourceItemIds.length === 0) {
    return [];
  }

  const db = getDb();
  const result = await db.execute(sql`
    SELECT
      sc."sourceItemId" AS document_id,
      sc."chunkIndex" AS chunk_index,
      sc.title,
      sc.content,
      sc.blurb,
      sc.link,
      sc."sourceConnectorType" AS source_connector_type,
      ts."externalRef" AS source_external_ref,
      sc."updatedAt" AS updated_at,
      0::float8 AS score
    FROM "SourceChunk" sc
    LEFT JOIN "TeamSource" ts ON ts.id = sc."sourceItemId"
    WHERE sc."tenantId" = ${args.tenantId}::uuid
      AND sc."knowledgeBaseId" = ${args.knowledgeBaseId}::uuid
      AND sc."sourceItemId" IN (${sql.join(
        args.sourceItemIds.map((id) => sql`${id}::uuid`),
        sql`, `
      )})
    ORDER BY sc."sourceItemId", sc."chunkIndex"
  `);

  return (result as unknown as PgChunkRow[]).map(mapPgRowToSearchResult);
}
