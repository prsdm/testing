import { CHUNK_INDEX_PREFIX } from "./constants";
import {
  envSearchRuntimeSettings,
  type SearchRuntimeSettings,
} from "./runtime-settings";

export function getVespaUrl() {
  return process.env.VESPA_URL ?? "http://localhost:8080";
}

export function isIndexingEnabled(settings?: SearchRuntimeSettings) {
  const resolved = settings ?? envSearchRuntimeSettings();
  return resolved.indexingEnabled;
}

/** Vespa schema/index name. Prefer stable tenant id (not slug) so renames stay consistent. */
export function getTenantIndexName(tenantIdOrSlug: string) {
  const safe = tenantIdOrSlug.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  return `${CHUNK_INDEX_PREFIX}_${safe}`;
}

/** @deprecated Use SearchRuntimeSettings from DB or envSearchRuntimeSettings() */
export function getSearchSettings() {
  const settings = envSearchRuntimeSettings();
  return {
    embeddingDimension: settings.embeddingDimension,
    embeddingModel: settings.embeddingModel,
    embeddingNormalize: settings.embeddingNormalize,
    embeddingPassagePrefix: settings.embeddingPassagePrefix,
    embeddingQueryPrefix: settings.embeddingQueryPrefix,
  };
}
