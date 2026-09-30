import type { SourceConnectorType } from "@/core/lib/db/source-queries";
import { isNotionDatabaseIndexRef } from "@/core/lib/sources/notion-source-refs";
import {
  collectIndexedNotionDatabaseTitles,
  isIndexedNotionDatabaseRowItem,
  notionDatabaseTitleFromKbTitle,
} from "@/core/lib/sources/source-item-display";

type KbItemScopeFields = {
  id: string;
  title: string;
  sourceType: SourceConnectorType;
  externalRef?: string | null;
};

/** Intersect ACL-visible KB items with an agent's allowed scope. */
export function filterVisibleItemsByAgentKbScope<T extends { id: string }>(
  visibleItems: T[],
  allowedSourceItemIds: string[] | null | undefined
): T[] {
  if (!allowedSourceItemIds || allowedSourceItemIds.length === 0) {
    return visibleItems;
  }

  const allowed = new Set(allowedSourceItemIds);
  return visibleItems.filter((item) => allowed.has(item.id));
}

export function buildNotionRowParentIdMap(items: KbItemScopeFields[]) {
  const parentIdByTitle = new Map<string, string>();
  for (const item of items) {
    const externalRef = item.externalRef?.trim();
    if (!externalRef || !isNotionDatabaseIndexRef(externalRef)) {
      continue;
    }
    parentIdByTitle.set(notionDatabaseTitleFromKbTitle(item.title), item.id);
  }

  const indexedDatabaseTitles = collectIndexedNotionDatabaseTitles(items);
  const rowParentIds: Record<string, string> = {};
  for (const item of items) {
    if (!isIndexedNotionDatabaseRowItem(item, indexedDatabaseTitles)) {
      continue;
    }
    for (const [databaseTitle, parentId] of parentIdByTitle) {
      if (item.title.startsWith(`${databaseTitle} / `)) {
        rowParentIds[item.id] = parentId;
        break;
      }
    }
  }

  return rowParentIds;
}

export function normalizeAgentAllowedSourceItemIds(
  allowedIds: string[],
  selectableItemIds: Set<string>,
  rowParentIds: Record<string, string>
) {
  const normalized = new Set<string>();
  for (const id of allowedIds) {
    if (selectableItemIds.has(id)) {
      normalized.add(id);
      continue;
    }
    const parentId = rowParentIds[id];
    if (parentId) {
      normalized.add(parentId);
    }
  }
  return [...normalized];
}

/** Database parent KB items are catalog-only; include their indexed row items at search time. */
export function expandAllowedKbItemIdsForSearch(
  allowedIds: string[],
  allItems: KbItemScopeFields[]
) {
  const expanded = new Set(allowedIds);
  const parentIdByTitle = new Map<string, string>();

  for (const item of allItems) {
    const externalRef = item.externalRef?.trim();
    if (!externalRef || !isNotionDatabaseIndexRef(externalRef)) {
      continue;
    }
    parentIdByTitle.set(notionDatabaseTitleFromKbTitle(item.title), item.id);
  }

  for (const allowedId of allowedIds) {
    for (const [databaseTitle, parentId] of parentIdByTitle) {
      if (parentId !== allowedId) {
        continue;
      }
      const prefix = `${databaseTitle} / `;
      for (const item of allItems) {
        const externalRef = item.externalRef?.trim();
        if (
          item.sourceType !== "notion" ||
          !externalRef ||
          isNotionDatabaseIndexRef(externalRef) ||
          !item.title.startsWith(prefix)
        ) {
          continue;
        }
        expanded.add(item.id);
      }
    }
  }

  return [...expanded];
}

/** Agent picked specific docs or source types — search must stay inside that box. */
export function isAgentKnowledgeSearchScoped(args: {
  allowedSourceItemIds?: string[] | null;
  allowedSourceConnectorTypes?: string[] | null;
}) {
  return (
    (args.allowedSourceItemIds?.length ?? 0) > 0 ||
    (args.allowedSourceConnectorTypes?.length ?? 0) > 0
  );
}

/**
 * When an agent is KB-scoped, do not fan out live Slack/Gmail/Jira/Calendar or
 * merge the open indexed Slack corpus — those bypass the doc allowlist.
 * Source-type-only scope may still include indexed Slack if "slack" is allowed.
 */
export function resolveHybridAccessForAgentKbScope(args: {
  allowedSourceItemIds?: string[] | null;
  allowedSourceConnectorTypes?: string[] | null;
  liveSources?: {
    slack?: boolean;
    jira?: boolean;
    gmail?: boolean;
    calendar?: boolean;
  };
}) {
  const scoped = isAgentKnowledgeSearchScoped(args);
  if (!scoped) {
    return {
      includeIndexedSlack: true,
      liveSources: {
        calendar: args.liveSources?.calendar === true,
        gmail: args.liveSources?.gmail === true,
        jira: args.liveSources?.jira === true,
        slack: args.liveSources?.slack === true,
      },
    };
  }

  const itemScoped = (args.allowedSourceItemIds?.length ?? 0) > 0;
  const sourceTypes = new Set(args.allowedSourceConnectorTypes ?? []);

  return {
    includeIndexedSlack: !itemScoped && sourceTypes.has("slack"),
    liveSources: {
      calendar: false,
      gmail: false,
      jira: false,
      slack: false,
    },
  };
}
