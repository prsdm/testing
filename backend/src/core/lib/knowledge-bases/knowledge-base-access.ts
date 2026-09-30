import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  type KnowledgeBase,
  knowledgeBaseMembers,
  knowledgeBases,
} from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";
import {
  type KnowledgeBaseViewerRole,
  knowledgeBaseRoleAtLeast,
} from "@/shared/knowledge-bases/knowledge-base-access";

const db = getDb();

export type KnowledgeBaseAccess = {
  knowledgeBase: KnowledgeBase;
  role: KnowledgeBaseViewerRole;
};

export async function getKnowledgeBaseAccess(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
}): Promise<KnowledgeBaseAccess | null> {
  const [knowledgeBase] = await db
    .select()
    .from(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, args.knowledgeBaseId),
        eq(knowledgeBases.tenantId, args.tenantId)
      )
    )
    .limit(1);

  if (!knowledgeBase) {
    return null;
  }

  if (knowledgeBase.createdByUserId === args.userId) {
    return { knowledgeBase, role: "owner" };
  }

  const [member] = await db
    .select()
    .from(knowledgeBaseMembers)
    .where(
      and(
        eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId),
        eq(knowledgeBaseMembers.userId, args.userId)
      )
    )
    .limit(1);

  if (!member) {
    return null;
  }

  return {
    knowledgeBase,
    role: member.role,
  };
}

export async function requireKnowledgeBaseAccess(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  minimumRole: KnowledgeBaseViewerRole;
}): Promise<KnowledgeBaseAccess> {
  const access = await getKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (!access) {
    throw new ChatbotError("not_found:api", "Knowledge base not found");
  }

  if (!knowledgeBaseRoleAtLeast(access.role, args.minimumRole)) {
    throw new ChatbotError(
      "forbidden:api",
      "Insufficient knowledge base access"
    );
  }

  return access;
}
