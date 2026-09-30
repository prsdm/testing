import { EMBEDDING_DIMENSION } from "./constants";

export const INDEX_FIELDS = {
  accessControlList: "access_control_list",
  blurb: "blurb",
  chunkIndex: "chunk_index",
  content: "content",
  contentVector: "content_vector",
  documentId: "document_id",
  lastUpdated: "last_updated",
  legacyKbCreatedByUserId: "kb_created_by_user_id",
  legacyKbExternalRef: "kb_external_ref",
  /** @deprecated Prefer source_* fields; kept for dual-read/write during migration. */
  legacyKbSourceType: "kb_source_type",
  legacyKbVisibility: "kb_visibility",
  link: "link",
  sourceConnectorType: "source_connector_type",
  sourceCreatedByUserId: "source_created_by_user_id",
  sourceExternalRef: "source_external_ref",
  sourceType: "source_type",
  sourceVisibility: "source_visibility",
  tenantId: "tenant_id",
  title: "title",
  titleVector: "title_vector",
} as const;

export const VESPA_DOCUMENT_TYPE = "kimi_chunk";
export const VESPA_NAMESPACE = "kimi";

export function getChunkDocumentId(
  documentId: string,
  chunkIndex: number,
  maxChunkSize: number
) {
  return `${documentId}__${maxChunkSize}__${chunkIndex}`;
}

export function encodeVespaDocumentId(documentId: string) {
  return documentId.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function getDefaultEmbeddingDimension() {
  return EMBEDDING_DIMENSION;
}
