import {
  KB_LIST_DEFAULT_PAGE_SIZE,
  KB_LIST_MAX_PAGE_SIZE,
  listVisibleTeamKbItemsMetadataPage,
  type TeamSourceListRow,
} from "@/core/lib/db/source-queries";
import { filterKnowledgeItemsByStoredAcl } from "@/core/lib/sources/stored-acl-access";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";

export type KbListApiItem = {
  id: string;
  title: string;
  sourceType: TeamSourceListRow["sourceType"];
  visibility: TeamSourceListRow["visibility"];
  createdByUserId: string | null;
  indexedByEmail: string | null;
  indexedByName: string | null;
  externalRef: string | null;
  link: string | null;
  sourceUpdatedAt: string | null;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KbListApiResponse = {
  items: KbListApiItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toKbListApiItem(item: TeamSourceListRow): KbListApiItem {
  return {
    createdAt: toIsoString(item.createdAt) ?? new Date().toISOString(),
    createdByUserId: item.createdByUserId,
    externalRef: item.externalRef,
    id: item.id,
    indexedByEmail: item.indexedByEmail,
    indexedByName: item.indexedByName,
    lastIndexedAt: toIsoString(item.lastIndexedAt),
    link: item.link,
    sourceType: item.sourceType,
    sourceUpdatedAt: toIsoString(item.sourceUpdatedAt),
    title: item.title,
    updatedAt: toIsoString(item.updatedAt) ?? new Date().toISOString(),
    visibility: item.visibility,
  };
}

export function parseKbListPageParams(searchParams: URLSearchParams) {
  const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const parsedLimit = Number.parseInt(
    searchParams.get("limit") ?? String(KB_LIST_DEFAULT_PAGE_SIZE),
    10
  );
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, KB_LIST_MAX_PAGE_SIZE)
      : KB_LIST_DEFAULT_PAGE_SIZE;

  return { limit, page };
}

export async function listAllVisibleKbItemsMetadata(args: {
  tenantId: string;
  userEmail: string;
  userId: string;
}) {
  const userAclTokens = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  const items: TeamSourceListRow[] = [];
  let page = 1;
  const limit = 500;

  while (true) {
    const batch = await listVisibleTeamKbItemsMetadataPage({
      limit,
      page,
      tenantId: args.tenantId,
      userAclTokens,
      userId: args.userId,
    });
    items.push(...batch);
    if (batch.length < limit) {
      break;
    }
    page += 1;
  }

  return filterKnowledgeItemsByStoredAcl(items, {
    userAclTokens,
    userEmail: args.userEmail,
    userId: args.userId,
  });
}

export async function getPaginatedVisibleKbItems(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  page: number;
  limit: number;
}): Promise<KbListApiResponse> {
  const userAclTokens = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  // SQL visibility rules match stored-acl-access; post-filter is defense-in-depth
  // and should not shrink the page when ACL is backfilled.
  const rawItems = await listVisibleTeamKbItemsMetadataPage({
    limit: args.limit,
    page: args.page,
    tenantId: args.tenantId,
    userAclTokens,
    userId: args.userId,
  });
  const items = filterKnowledgeItemsByStoredAcl(rawItems, {
    userAclTokens,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  return {
    hasMore: rawItems.length === args.limit,
    items: items.map(toKbListApiItem),
    limit: args.limit,
    page: args.page,
  };
}
