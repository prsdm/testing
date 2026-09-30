import { getKnowledgeBaseForUser } from "@/core/lib/knowledge-bases/knowledge-base-queries";

export type KnowledgeBaseChatContext = {
  knowledgeBaseId: string;
  tenantId: string;
  userId: string;
  knowledgeBaseName: string;
};

export async function resolveKnowledgeBaseChatContext(args: {
  tenantId: string;
  userId: string;
  knowledgeBaseId: string;
}): Promise<KnowledgeBaseChatContext | null> {
  const knowledgeBase = await getKnowledgeBaseForUser({
    knowledgeBaseId: args.knowledgeBaseId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (!knowledgeBase) {
    return null;
  }

  return {
    knowledgeBaseId: knowledgeBase.id,
    knowledgeBaseName: knowledgeBase.name,
    tenantId: args.tenantId,
    userId: args.userId,
  };
}
