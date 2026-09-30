import { getTenantSlackIndexStateMap } from "@/core/lib/db/slack-index-state-queries";
import {
  listVisibleTeamKbItemsMetadataPage,
  type SourceConnectorType,
  type TeamSourceListRow,
} from "@/core/lib/db/source-queries";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
import { getKnowledgeConnectorPinFlags } from "@/core/lib/sources/connector-pin-flags";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import { toSharePointPageRef } from "@/core/lib/sources/index-sharepoint-pages";
import { getNotionAccessForUser } from "@/core/lib/sources/notion-access";
import {
  databaseIdFromNotionIndexRef,
  isNotionDatabaseIndexRef,
} from "@/core/lib/sources/notion-source-refs";
import { getSharePointAccessForUser } from "@/core/lib/sources/sharepoint-access";
import { getSlackAccessForUser } from "@/core/lib/sources/slack-access";
import {
  catalogFetchAllConfluencePages,
  catalogFetchAllDriveFiles,
  catalogFetchAllNotionItems,
  catalogFetchAllSharePointPages,
  catalogFetchAllSlackChannels,
} from "@/core/lib/sources/source-catalog-browse";
import {
  collectIndexedNotionDatabaseTitles,
  countNotionDatabaseIndexedRows,
  isIndexedNotionDatabaseRowItem,
} from "@/core/lib/sources/source-item-display";
import { filterKnowledgeItemsByStoredAcl } from "@/core/lib/sources/stored-acl-access";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";
import type {
  KbCatalogResponse,
  KbCatalogRow,
  KbCatalogStatus,
} from "@/shared/sources/source-catalog-types";
import { compareKbCatalogRowsByIndexStatus } from "@/shared/sources/source-item-status";

const CONNECTOR_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
  "slack",
]);

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toMillis(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function catalogRefKey(sourceType: SourceConnectorType, externalRef: string) {
  return `${sourceType}:${externalRef}`;
}

function resolveConnectorStatus(args: {
  sourceType: SourceConnectorType;
  externalRef: string;
  modifiedAt: string | null;
  kbItem: TeamSourceListRow | undefined;
}): KbCatalogStatus {
  if (!args.kbItem) {
    return "not_indexed";
  }
  if (!CONNECTOR_SOURCE_TYPES.has(args.sourceType)) {
    return "added";
  }
  const sourceMs = toMillis(
    args.modifiedAt ?? toIso(args.kbItem.sourceUpdatedAt)
  );
  const indexedMs = toMillis(toIso(args.kbItem.lastIndexedAt));
  if (sourceMs > 0 && indexedMs > 0 && sourceMs > indexedMs) {
    return "update_available";
  }
  return "indexed";
}

function kbItemToCatalogRow(item: TeamSourceListRow): KbCatalogRow | null {
  const externalRef = item.externalRef?.trim();
  if (
    item.sourceType === "notion" &&
    externalRef &&
    isNotionDatabaseIndexRef(externalRef)
  ) {
    return null;
  }
  if (
    !externalRef &&
    item.sourceType !== "manual" &&
    item.sourceType !== "upload"
  ) {
    return null;
  }

  const ref = externalRef ?? item.id;
  return {
    createdAt: toIso(item.createdAt),
    createdByUserId: item.createdByUserId,
    externalRef: ref,
    indexedByEmail: item.indexedByEmail,
    indexedByName: item.indexedByName,
    kbItemId: item.id,
    lastIndexedAt: toIso(item.lastIndexedAt),
    link: item.link,
    modifiedAt: toIso(item.sourceUpdatedAt) ?? toIso(item.updatedAt),
    rowKey: catalogRefKey(item.sourceType, ref),
    sourceType: item.sourceType,
    status:
      item.sourceType === "manual" || item.sourceType === "upload"
        ? "added"
        : "indexed",
    title: item.title,
  };
}

function overlayKbItem(row: KbCatalogRow, item: TeamSourceListRow) {
  return {
    ...row,
    createdAt: toIso(item.createdAt) ?? row.createdAt,
    createdByUserId: item.createdByUserId,
    indexedByEmail: item.indexedByEmail,
    indexedByName: item.indexedByName,
    kbItemId: item.id,
    lastIndexedAt: toIso(item.lastIndexedAt),
    link: item.link ?? row.link,
    status: resolveConnectorStatus({
      externalRef: row.externalRef,
      kbItem: item,
      modifiedAt: row.modifiedAt,
      sourceType: row.sourceType,
    }),
  };
}

const KB_METADATA_PAGE_SIZE = 500;

async function loadKbIndexMap(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
}) {
  const userAclTokens = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  const rawItems: TeamSourceListRow[] = [];
  let page = 1;

  while (true) {
    const batch = await listVisibleTeamKbItemsMetadataPage({
      limit: KB_METADATA_PAGE_SIZE,
      page,
      tenantId: args.tenantId,
      userAclTokens,
      userId: args.userId,
    });
    rawItems.push(...batch);
    if (batch.length < KB_METADATA_PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  const items = filterKnowledgeItemsByStoredAcl(rawItems, {
    userAclTokens,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  const byRef = new Map<string, TeamSourceListRow>();
  for (const item of items) {
    const externalRef = item.externalRef?.trim();
    if (!externalRef) {
      continue;
    }
    byRef.set(catalogRefKey(item.sourceType, externalRef), item);
    if (item.sourceType === "notion") {
      const databaseId = databaseIdFromNotionIndexRef(externalRef);
      if (databaseId) {
        byRef.set(catalogRefKey("notion", databaseId), item);
      }
    }
  }
  return { byRef, items };
}

export async function buildKbCatalog(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}): Promise<KbCatalogResponse> {
  const connectors = await getKnowledgeConnectorPinFlags({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  const { items: kbItems, byRef: kbByRef } = await loadKbIndexMap(args);
  const rowsByKey = new Map<string, KbCatalogRow>();
  const notionCatalogContext = { workspaceName: null as string | null };

  const addRow = (row: KbCatalogRow) => {
    const kbItem = kbByRef.get(catalogRefKey(row.sourceType, row.externalRef));
    rowsByKey.set(row.rowKey, kbItem ? overlayKbItem(row, kbItem) : row);
  };

  const sourceFetches: Promise<void>[] = [];

  if (connectors.drivePinEnabled) {
    sourceFetches.push(
      (async () => {
        const access = await getDriveAccessForUser({
          tenantId: args.tenantId,
          tenantSlug: args.tenantSlug,
          userEmail: args.userEmail,
          userId: args.userId,
        });
        if (!access.ok) {
          return;
        }
        const files = await catalogFetchAllDriveFiles({
          accessToken: access.accessToken,
          tenantId: args.tenantId,
        });
        for (const file of files) {
          addRow({
            createdByUserId: null,
            driveIsSharedDrive: Boolean(file.driveId),
            driveMimeType: file.mimeType,
            externalRef: file.fileId,
            indexedByEmail: null,
            indexedByName: null,
            kbItemId: null,
            lastIndexedAt: null,
            link: file.link,
            modifiedAt: file.modifiedTime ?? null,
            rowKey: catalogRefKey("drive", file.fileId),
            sourceType: "drive",
            status: "not_indexed",
            title: file.title,
          });
        }
      })()
    );
  }

  if (connectors.confluencePinEnabled) {
    sourceFetches.push(
      (async () => {
        const access = await getConfluenceAccessForUser({
          tenantId: args.tenantId,
          userId: args.userId,
        });
        if (!access.ok) {
          return;
        }
        const pageBatches = await catalogFetchAllConfluencePages({
          accessToken: access.accessToken,
          cloudId: access.cloudId,
          siteUrl: access.siteUrl,
        });
        for (const { space, pages } of pageBatches) {
          for (const page of pages) {
            addRow({
              confluenceSpaceKey: space.key,
              confluenceSpaceName: space.name,
              createdByUserId: null,
              externalRef: page.pageId,
              indexedByEmail: null,
              indexedByName: null,
              kbItemId: null,
              lastIndexedAt: null,
              link: page.link,
              modifiedAt: page.modifiedTime ?? null,
              rowKey: catalogRefKey("confluence", page.pageId),
              sourceType: "confluence",
              status: "not_indexed",
              title: page.title,
            });
          }
        }
      })()
    );
  }

  if (connectors.notionPinEnabled) {
    sourceFetches.push(
      (async () => {
        const access = await getNotionAccessForUser({
          tenantId: args.tenantId,
          userId: args.userId,
        });
        if (!access.ok) {
          return;
        }
        notionCatalogContext.workspaceName = access.workspaceName;
        const { pages, databases } = await catalogFetchAllNotionItems({
          accessToken: access.accessToken,
        });
        for (const page of pages) {
          if (page.parentDataSourceId) {
            continue;
          }
          addRow({
            createdByUserId: null,
            externalRef: page.pageId,
            indexedByEmail: null,
            indexedByName: null,
            kbItemId: null,
            lastIndexedAt: null,
            link: page.link,
            modifiedAt: page.modifiedTime ?? null,
            notionKind: "page",
            notionWorkspaceName: access.workspaceName,
            rowKey: catalogRefKey("notion", page.pageId),
            sourceType: "notion",
            status: "not_indexed",
            title: page.title,
          });
        }
        for (const database of databases) {
          const indexedRowCount = countNotionDatabaseIndexedRows(
            kbItems,
            database.title
          );
          addRow({
            createdByUserId: null,
            externalRef: database.databaseId,
            indexedByEmail: null,
            indexedByName: null,
            kbItemId: null,
            lastIndexedAt: null,
            link: database.link,
            modifiedAt: null,
            notionIndexedRowCount:
              indexedRowCount > 0 ? indexedRowCount : undefined,
            notionKind: "database",
            notionWorkspaceName: access.workspaceName,
            rowKey: catalogRefKey("notion", database.databaseId),
            sourceType: "notion",
            status: "not_indexed",
            title: database.title,
          });
        }
      })()
    );
  }

  if (connectors.sharePointPinEnabled) {
    sourceFetches.push(
      (async () => {
        const access = await getSharePointAccessForUser({
          tenantId: args.tenantId,
          userId: args.userId,
        });
        if (!access.ok) {
          return;
        }
        const pages = await catalogFetchAllSharePointPages({
          accessToken: access.accessToken,
        });
        for (const page of pages) {
          const pageRef = toSharePointPageRef(page);
          addRow({
            createdByUserId: null,
            externalRef: pageRef,
            indexedByEmail: null,
            indexedByName: null,
            kbItemId: null,
            lastIndexedAt: null,
            link: page.link,
            modifiedAt: page.modifiedTime ?? null,
            rowKey: catalogRefKey("sharepoint", pageRef),
            sharePointSiteName: page.siteName ?? null,
            sourceType: "sharepoint",
            status: "not_indexed",
            title: page.title,
          });
        }
      })()
    );
  }

  if (connectors.slackPinEnabled) {
    sourceFetches.push(
      (async () => {
        const access = await getSlackAccessForUser({
          tenantId: args.tenantId,
          userId: args.userId,
        });
        if (!access.ok) {
          return;
        }
        const [channels, slackState] = await Promise.all([
          catalogFetchAllSlackChannels({
            accessToken: access.accessToken,
            teamUrl: access.teamUrl,
            tenantId: args.tenantId,
          }),
          getTenantSlackIndexStateMap(args.tenantId),
        ]);
        for (const channel of channels) {
          const state = slackState.get(channel.channelId);
          const indexed = state?.lastStatus === "indexed";
          addRow({
            createdByUserId: null,
            externalRef: channel.channelId,
            indexedByEmail: null,
            indexedByName: null,
            kbItemId: null,
            lastIndexedAt: indexed ? toIso(state?.lastIndexedAt) : null,
            link: channel.link,
            modifiedAt: null,
            rowKey: catalogRefKey("slack", channel.channelId),
            slackIsPrivate: channel.isPrivate,
            sourceType: "slack",
            status: indexed ? "indexed" : "not_indexed",
            title: channel.name.startsWith("#")
              ? channel.name
              : `#${channel.name}`,
          });
        }
      })()
    );
  }

  await Promise.all(sourceFetches);

  if (notionCatalogContext.workspaceName) {
    for (const [rowKey, row] of rowsByKey) {
      if (row.sourceType === "notion" && !row.notionWorkspaceName) {
        rowsByKey.set(rowKey, {
          ...row,
          notionWorkspaceName: notionCatalogContext.workspaceName,
        });
      }
    }
  }

  const indexedNotionDatabaseTitles =
    collectIndexedNotionDatabaseTitles(kbItems);

  for (const item of kbItems) {
    if (isIndexedNotionDatabaseRowItem(item, indexedNotionDatabaseTitles)) {
      continue;
    }
    const row = kbItemToCatalogRow(item);
    if (!row) {
      continue;
    }
    if (!rowsByKey.has(row.rowKey)) {
      rowsByKey.set(row.rowKey, row);
      continue;
    }
    const existing = rowsByKey.get(row.rowKey);
    if (existing) {
      rowsByKey.set(row.rowKey, overlayKbItem(existing, item));
    }
  }

  const rows = [...rowsByKey.values()].sort(compareKbCatalogRowsByIndexStatus);

  return { connectors, rows };
}
