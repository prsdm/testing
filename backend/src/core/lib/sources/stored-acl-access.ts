import type { SourceConnectorType } from "@/shared/sources/source-types";

const EXTERNAL_SHARED_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
]);

export type KnowledgeAclItem = {
  id: string;
  sourceType: SourceConnectorType;
  visibility: "private" | "shared";
  externalRef: string | null;
  createdByUserId: string | null;
  sourceExternalAccess?: unknown;
  accessControlList?: string[] | null;
};

function isConnectorSourceType(sourceType: SourceConnectorType) {
  return EXTERNAL_SHARED_SOURCE_TYPES.has(sourceType);
}

export function accessControlListsOverlap(
  userTokens: readonly string[],
  itemTokens: readonly string[] | null | undefined
) {
  if (!itemTokens || itemTokens.length === 0 || userTokens.length === 0) {
    return false;
  }
  const userTokenSet = new Set(userTokens);
  for (const token of itemTokens) {
    if (userTokenSet.has(token)) {
      return true;
    }
  }
  return false;
}

/**
 * Matches SQL listing rules in listVisibleTeamKbItemsMetadataPage:
 * - Manual/upload private: owner only
 * - Manual/upload shared: ACL overlap
 * - Connector private: owner only
 * - Connector shared: ACL overlap (empty ACL fails closed)
 *
 * Direct sourceExternalAccess email fallbacks were removed so list SQL and
 * in-memory filters stay aligned. Emails/groups must be in accessControlList.
 */
export function userCanAccessKnowledgeItem(args: {
  userId: string;
  userEmail: string;
  userAclTokens: readonly string[];
  item: KnowledgeAclItem;
}) {
  const isOwner = args.item.createdByUserId === args.userId;

  if (!isConnectorSourceType(args.item.sourceType)) {
    if (isOwner) {
      return true;
    }
    if (args.item.visibility === "private") {
      return false;
    }
    return accessControlListsOverlap(
      args.userAclTokens,
      args.item.accessControlList
    );
  }

  if (args.item.visibility === "private") {
    return isOwner;
  }

  return accessControlListsOverlap(
    args.userAclTokens,
    args.item.accessControlList
  );
}

export function filterKnowledgeItemsByStoredAcl<T extends KnowledgeAclItem>(
  items: T[],
  args: {
    userId: string;
    userEmail: string;
    userAclTokens: readonly string[];
  }
): T[] {
  return items.filter((item) =>
    userCanAccessKnowledgeItem({
      item,
      userAclTokens: args.userAclTokens,
      userEmail: args.userEmail,
      userId: args.userId,
    })
  );
}
