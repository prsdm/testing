import type { SourceConnectorType } from "@/core/lib/db/source-queries";
import { filterKnowledgeItemsByStoredAcl } from "@/core/lib/sources/stored-acl-access";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";

type KnowledgeLikeItem = {
  id: string;
  sourceType: SourceConnectorType;
  visibility: "private" | "shared";
  externalRef: string | null;
  createdByUserId: string | null;
  sourceExternalAccess?: unknown;
  accessControlList?: string[] | null;
};

export async function filterVisibleKnowledgeItemsForUser<
  T extends KnowledgeLikeItem,
>(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  items: T[];
}): Promise<T[]> {
  if (args.items.length === 0) {
    return [];
  }

  const userAclTokens = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  return filterKnowledgeItemsByStoredAcl(args.items, {
    userAclTokens,
    userEmail: args.userEmail,
    userId: args.userId,
  });
}
