import {
  DEFAULT_SEARCH_LIMIT,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL_ID,
  EMBEDDING_PASSAGE_PREFIX,
  EMBEDDING_QUERY_PREFIX,
  OPENAI_EMBEDDING_MODEL_ID,
} from "./constants";
import { getEmbeddingProvider } from "./embedding-provider";

export type SearchRuntimeSettings = {
  embeddingModel: string;
  embeddingDimension: number;
  embeddingNormalize: boolean;
  embeddingQueryPrefix: string;
  embeddingPassagePrefix: string;
  maxContextLength: number;
  indexingEnabled: boolean;
  maxIndexedContentSizeMb: number;
  searchLimit: number;
};

export function envSearchRuntimeSettings(): SearchRuntimeSettings {
  const provider = getEmbeddingProvider();
  const isOpenAI = provider === "openai";

  return {
    embeddingDimension: Number(
      process.env.EMBEDDING_DIM ?? EMBEDDING_DIMENSION
    ),
    embeddingModel:
      process.env.EMBEDDING_MODEL ??
      (isOpenAI ? OPENAI_EMBEDDING_MODEL_ID : EMBEDDING_MODEL_ID),
    embeddingNormalize: process.env.EMBEDDING_NORMALIZE !== "false",
    embeddingPassagePrefix: isOpenAI
      ? (process.env.EMBEDDING_PASSAGE_PREFIX ?? "")
      : (process.env.EMBEDDING_PASSAGE_PREFIX ?? EMBEDDING_PASSAGE_PREFIX),
    // BGE query prefix is TEI-specific; OpenAI models should not use it.
    embeddingQueryPrefix: isOpenAI
      ? (process.env.EMBEDDING_QUERY_PREFIX ?? "")
      : (process.env.EMBEDDING_QUERY_PREFIX ?? EMBEDDING_QUERY_PREFIX),
    indexingEnabled: process.env.INDEXING_ENABLED !== "false",
    maxContextLength: Number(process.env.EMBEDDING_MAX_CONTEXT ?? "512"),
    maxIndexedContentSizeMb: Number(
      process.env.MAX_INDEXED_CONTENT_SIZE_MB ?? "10"
    ),
    searchLimit: Number(
      process.env.SEARCH_LIMIT ?? String(DEFAULT_SEARCH_LIMIT)
    ),
  };
}

export function mergeSearchRuntimeSettings(
  row: Partial<SearchRuntimeSettings> | null | undefined
): SearchRuntimeSettings {
  const defaults = envSearchRuntimeSettings();
  if (!row) {
    return defaults;
  }
  return {
    embeddingDimension: row.embeddingDimension ?? defaults.embeddingDimension,
    embeddingModel: row.embeddingModel ?? defaults.embeddingModel,
    embeddingNormalize: row.embeddingNormalize ?? defaults.embeddingNormalize,
    embeddingPassagePrefix:
      row.embeddingPassagePrefix ?? defaults.embeddingPassagePrefix,
    embeddingQueryPrefix:
      row.embeddingQueryPrefix ?? defaults.embeddingQueryPrefix,
    indexingEnabled:
      row.indexingEnabled === false ? false : defaults.indexingEnabled,
    maxContextLength: row.maxContextLength ?? defaults.maxContextLength,
    maxIndexedContentSizeMb:
      row.maxIndexedContentSizeMb ?? defaults.maxIndexedContentSizeMb,
    searchLimit: row.searchLimit ?? defaults.searchLimit,
  };
}
