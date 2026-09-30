export const EMBEDDING_MODEL_ID = "BAAI/bge-base-en-v1.5";
export const OPENAI_EMBEDDING_MODEL_ID = "text-embedding-3-small";
/** Keep 768 so OpenAI (via dimensions=) and local TEI/bge share the same pgvector column. */
export const EMBEDDING_DIMENSION = 768;
export const EMBEDDING_QUERY_PREFIX =
  "Represent this sentence for searching relevant passages: ";
export const EMBEDDING_PASSAGE_PREFIX = "";
export const PUBLIC_DOC_PAT = "PUBLIC";

export const CHUNK_INDEX_PREFIX = "kimi_chunks";
export const DEFAULT_CHUNK_SIZE = 512;
export const DEFAULT_CHUNK_OVERLAP = 64;
export const DEFAULT_SEARCH_LIMIT = 12;
