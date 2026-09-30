import type { DocumentSourceType } from "./types";

/** Canonical indexed document source types (written to Vespa). */
export const PERSONAL_SOURCE_TYPE = "personal_source" as const;
export const TEAM_SOURCE_TYPE = "team_source" as const;

const LEGACY_PERSONAL = "personal_kb";
const LEGACY_TEAM = "team_kb";

export function normalizeDocumentSourceType(
  raw: string | undefined | null
): DocumentSourceType {
  if (raw === LEGACY_PERSONAL || raw === PERSONAL_SOURCE_TYPE) {
    return PERSONAL_SOURCE_TYPE;
  }
  if (raw === "google_drive") {
    return "google_drive";
  }
  if (raw === "slack") {
    return "slack";
  }
  if (raw === LEGACY_TEAM || raw === TEAM_SOURCE_TYPE || !raw) {
    return TEAM_SOURCE_TYPE;
  }
  return TEAM_SOURCE_TYPE;
}

export function isTeamOrPersonalSourceType(
  sourceType: string | undefined | null
) {
  return (
    sourceType === TEAM_SOURCE_TYPE ||
    sourceType === PERSONAL_SOURCE_TYPE ||
    sourceType === LEGACY_TEAM ||
    sourceType === LEGACY_PERSONAL
  );
}

export function isInternalCitationKind(kind: string | undefined | null) {
  return kind === "source" || kind === "kb";
}
