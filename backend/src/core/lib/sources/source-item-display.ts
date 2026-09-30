import type { SourceConnectorType } from "@/core/lib/db/source-queries";
import { isNotionDatabaseIndexRef } from "@/core/lib/sources/notion-source-refs";

export type KbItemTitleFields = {
  title: string;
  sourceType: SourceConnectorType;
  externalRef?: string | null;
};

export function notionDatabaseTitleFromKbTitle(title: string) {
  return title.replace(/ \(database\)$/, "").trim();
}

export function collectIndexedNotionDatabaseTitles(
  kbItems: KbItemTitleFields[]
) {
  const titles = new Set<string>();
  for (const item of kbItems) {
    const externalRef = item.externalRef?.trim();
    if (!externalRef || !isNotionDatabaseIndexRef(externalRef)) {
      continue;
    }
    const title = notionDatabaseTitleFromKbTitle(item.title);
    if (title) {
      titles.add(title);
    }
  }
  return titles;
}

export function isIndexedNotionDatabaseRowItem(
  item: KbItemTitleFields,
  indexedDatabaseTitles: Set<string>
) {
  if (item.sourceType !== "notion" || indexedDatabaseTitles.size === 0) {
    return false;
  }
  const externalRef = item.externalRef?.trim();
  if (!externalRef || isNotionDatabaseIndexRef(externalRef)) {
    return false;
  }
  for (const databaseTitle of indexedDatabaseTitles) {
    if (item.title.startsWith(`${databaseTitle} / `)) {
      return true;
    }
  }
  return false;
}

export function filterSelectableKbItems<T extends KbItemTitleFields>(
  items: T[]
) {
  const indexedDatabaseTitles = collectIndexedNotionDatabaseTitles(items);
  return items.filter(
    (item) => !isIndexedNotionDatabaseRowItem(item, indexedDatabaseTitles)
  );
}

export function countNotionDatabaseIndexedRows(
  kbItems: KbItemTitleFields[],
  databaseTitle: string
) {
  const prefix = `${databaseTitle} / `;
  let count = 0;
  for (const item of kbItems) {
    const externalRef = item.externalRef?.trim();
    if (
      item.sourceType !== "notion" ||
      !externalRef ||
      isNotionDatabaseIndexRef(externalRef) ||
      !item.title.startsWith(prefix)
    ) {
      continue;
    }
    count += 1;
  }
  return count;
}

export function formatKbItemDisplayTitle(
  item: KbItemTitleFields,
  allItems: KbItemTitleFields[]
) {
  const externalRef = item.externalRef?.trim();
  if (externalRef && isNotionDatabaseIndexRef(externalRef)) {
    const databaseTitle = notionDatabaseTitleFromKbTitle(item.title);
    const rowCount = countNotionDatabaseIndexedRows(allItems, databaseTitle);
    if (rowCount > 0) {
      const rowLabel = rowCount === 1 ? "row" : "rows";
      return `${databaseTitle} · ${rowCount} ${rowLabel}`;
    }
    return databaseTitle;
  }
  return item.title;
}
