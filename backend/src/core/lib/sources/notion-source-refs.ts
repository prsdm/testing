export const NOTION_DATABASE_INDEX_REF_PREFIX = "notion-database:";

export function notionDatabaseIndexRef(databaseId: string) {
  return `${NOTION_DATABASE_INDEX_REF_PREFIX}${databaseId.trim()}`;
}

export function isNotionDatabaseIndexRef(externalRef: string) {
  return externalRef.startsWith(NOTION_DATABASE_INDEX_REF_PREFIX);
}

export function databaseIdFromNotionIndexRef(externalRef: string) {
  if (!isNotionDatabaseIndexRef(externalRef)) {
    return null;
  }
  return externalRef.slice(NOTION_DATABASE_INDEX_REF_PREFIX.length);
}
