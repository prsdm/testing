import { normalizeDocumentSourceType } from "@/shared/search/source-type-compat";
import type { SearchResultChunk } from "@/shared/search/types";
import { INDEX_FIELDS } from "../chunk-fields";
import { embedTexts } from "../embeddings";
import type { SearchRuntimeSettings } from "../runtime-settings";
import { envSearchRuntimeSettings } from "../runtime-settings";
import { vespaJson } from "./client";

/** Chat reads should fail fast — never block on Vespa deploy/health waits. */
const CHAT_VESPA_SEARCH_TIMEOUT_MS = 8000;

let vespaSearchCooldownUntil = 0;

type VespaSearchChild = {
  relevance?: number;
  fields?: Record<string, unknown>;
};

type VespaSearchResponse = {
  root?: {
    children?: VespaSearchChild[];
  };
};

function escapeYqlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAclClause(accessControlList: string[]) {
  if (accessControlList.length === 0) {
    // Fail closed: never search without user ACL tokens.
    return null;
  }
  const clauses = accessControlList.map(
    (entry) =>
      `${INDEX_FIELDS.accessControlList} contains "${escapeYqlString(entry)}"`
  );
  return ` and (${clauses.join(" or ")})`;
}

function normalizeSearchUpdatedAt(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function readField(
  source: Record<string, unknown>,
  primary: string,
  legacy: string
) {
  if (source[primary] !== undefined && source[primary] !== null) {
    return source[primary];
  }
  return source[legacy];
}

function mapConnectorType(raw: string) {
  if (raw === "drive") {
    return "drive" as const;
  }
  if (raw === "upload") {
    return "upload" as const;
  }
  if (raw === "confluence") {
    return "confluence" as const;
  }
  if (raw === "notion") {
    return "notion" as const;
  }
  if (raw === "sharepoint") {
    return "sharepoint" as const;
  }
  if (raw === "slack") {
    return "slack" as const;
  }
  if (raw === "manual") {
    return "manual" as const;
  }
}

function mapHitToResult(hit: VespaSearchChild): SearchResultChunk {
  const source = hit.fields ?? {};
  const sourceTypeRaw = String(
    source[INDEX_FIELDS.sourceType] ?? "team_source"
  );
  const connectorTypeRaw = String(
    readField(
      source,
      INDEX_FIELDS.sourceConnectorType,
      INDEX_FIELDS.legacyKbSourceType
    ) ?? ""
  );
  const visibilityRaw = String(
    readField(
      source,
      INDEX_FIELDS.sourceVisibility,
      INDEX_FIELDS.legacyKbVisibility
    ) ?? ""
  );
  const externalRef = readField(
    source,
    INDEX_FIELDS.sourceExternalRef,
    INDEX_FIELDS.legacyKbExternalRef
  );
  const createdByUserId = readField(
    source,
    INDEX_FIELDS.sourceCreatedByUserId,
    INDEX_FIELDS.legacyKbCreatedByUserId
  );

  return {
    blurb: String(source[INDEX_FIELDS.blurb] ?? ""),
    chunkIndex: Number(source[INDEX_FIELDS.chunkIndex] ?? 0),
    content: String(source[INDEX_FIELDS.content] ?? ""),
    documentId: String(source[INDEX_FIELDS.documentId] ?? ""),
    link: String(source[INDEX_FIELDS.link] ?? ""),
    score: Number(hit.relevance ?? 0),
    sourceConnectorType: mapConnectorType(connectorTypeRaw),
    sourceCreatedByUserId:
      typeof createdByUserId === "string" ? String(createdByUserId) : null,
    sourceExternalRef:
      typeof externalRef === "string" ? String(externalRef) : null,
    sourceType: normalizeDocumentSourceType(sourceTypeRaw),
    sourceVisibility:
      visibilityRaw === "private"
        ? "private"
        : visibilityRaw === "shared"
          ? "shared"
          : undefined,
    title: String(source[INDEX_FIELDS.title] ?? ""),
    updatedAt: normalizeSearchUpdatedAt(source[INDEX_FIELDS.lastUpdated]),
  };
}

export async function hybridSearchChunks(input: {
  indexName: string;
  tenantId: string;
  query: string;
  queryVector?: number[];
  accessControlList: string[];
  limit?: number;
  settings?: SearchRuntimeSettings;
}): Promise<SearchResultChunk[]> {
  if (Date.now() < vespaSearchCooldownUntil) {
    return [];
  }

  try {
    const settings = input.settings ?? envSearchRuntimeSettings();
    const limit = input.limit ?? settings.searchLimit;
    const queryVector =
      input.queryVector ??
      (await embedTexts([input.query], "query", settings)).at(0);

    if (!queryVector) {
      return [];
    }

    const vectorTargets = Math.max(limit * 4, 100);
    const aclClause = buildAclClause(input.accessControlList);
    if (aclClause === null) {
      return [];
    }
    const yql = `select * from kimi_chunk where tenant_id contains "${escapeYqlString(input.tenantId)}"${aclClause} and (({targetHits:${vectorTargets}}nearestNeighbor(content_vector, query_vector)) or ({targetHits:${vectorTargets}}nearestNeighbor(title_vector, query_vector)) or userInput(@query)) limit ${limit}`;

    const response = await vespaJson<VespaSearchResponse>("/search/", {
      body: JSON.stringify({
        hits: limit,
        "input.query(query_vector)": queryVector,
        query: input.query,
        ranking: { profile: "hybrid" },
        yql,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
      timeoutMs: CHAT_VESPA_SEARCH_TIMEOUT_MS,
    });

    const hits = response.root?.children ?? [];
    return hits.map(mapHitToResult);
  } catch (error) {
    // Legacy Vespa stack is optional; never throw infra errors into chat tools.
    vespaSearchCooldownUntil = Date.now() + 30_000;
    console.warn(
      "[hybridSearchChunks] workspace search unavailable:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
