export const NOTION_SHARE_MODES = [
  "indexers",
  "selected",
  "workspace",
] as const;

export type NotionShareMode = (typeof NOTION_SHARE_MODES)[number];

/**
 * Notion has no document ACL API comparable to Drive/Confluence.
 * These modes are Kimiro's own access policy for indexed Notion pages —
 * not a mirror of Notion permissions.
 */
function normalizeLegacyShareMode(
  shareMode?: NotionShareMode | "syncers"
): NotionShareMode | undefined {
  if (shareMode === "syncers") {
    return "indexers";
  }
  return shareMode;
}

export function resolveNotionShareMode(args: {
  shareMode?: NotionShareMode | "syncers";
  shareWithTeam?: boolean;
}): NotionShareMode {
  if (args.shareWithTeam === true) {
    return "workspace";
  }
  return normalizeLegacyShareMode(args.shareMode) ?? "indexers";
}
