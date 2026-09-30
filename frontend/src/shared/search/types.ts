/** Indexed document sources (Vespa / Sources). */
export type DocumentSourceType =
  | "google_drive"
  | "personal_source"
  | "team_source"
  | "slack";

/**
 * Live federated sources merged into source search.
 * Slack may also appear as an indexed DocumentSourceType (hybrid index ∥ live).
 */
export type LiveSearchSourceType = "slack" | "jira" | "gmail" | "calendar";

export type SearchResultSourceType = DocumentSourceType | LiveSearchSourceType;

export type IndexChunkInput = {
  documentId: string;
  chunkIndex: number;
  tenantId: string;
  title: string;
  content: string;
  blurb: string;
  link: string;
  sourceType: DocumentSourceType;
  accessControlList: string[];
  updatedAt?: Date | string | number;
  sourceConnectorType?:
    | "manual"
    | "drive"
    | "upload"
    | "confluence"
    | "notion"
    | "sharepoint"
    | "slack";
  sourceVisibility?: "private" | "shared";
  sourceExternalRef?: string | null;
  sourceCreatedByUserId?: string | null;
};

export type SearchResultChunk = {
  documentId: string;
  chunkIndex: number;
  title: string;
  content: string;
  blurb: string;
  link: string;
  sourceType: SearchResultSourceType;
  score: number;
  updatedAt?: string;
  sourceConnectorType?:
    | "manual"
    | "drive"
    | "upload"
    | "confluence"
    | "notion"
    | "sharepoint"
    | "slack";
  sourceVisibility?: "private" | "shared";
  sourceExternalRef?: string | null;
  sourceCreatedByUserId?: string | null;
};

export type InternalSearchStep =
  | { type: "queries"; queries: string[] }
  | { type: "reading"; results: SearchResultChunk[] }
  | { type: "done" };

export function searchResultChunkKey(
  chunk: Pick<SearchResultChunk, "documentId" | "chunkIndex">
) {
  return `${chunk.documentId}:${chunk.chunkIndex}`;
}
