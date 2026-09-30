import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { createTeamKbItem } from "@/core/lib/db/source-queries";
import {
  type KnowledgeBase,
  type KnowledgeBaseSource,
  knowledgeBaseMembers,
  knowledgeBaseSources,
  knowledgeBases,
  type TeamSource,
  teamSources,
} from "@/core/lib/db/tables";
import {
  getKnowledgeBaseAccess,
  requireKnowledgeBaseAccess,
} from "@/core/lib/knowledge-bases/knowledge-base-access";
import { chunkText } from "@/core/lib/search/chunker";
import {
  bulkIndexKnowledgeBaseChunks,
  deleteKnowledgeBaseSourceChunks,
  hybridSearchKnowledgeBaseChunks,
} from "@/core/lib/search/pg/knowledge-base-chunks";
import { buildKnowledgeItemAccessControlList } from "@/core/lib/sources/source-item-acl";
import { userCanAccessKnowledgeItem } from "@/core/lib/sources/stored-acl-access";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";
import { ChatbotError } from "@/shared/errors";
import type { KnowledgeBaseViewerRole } from "@/shared/knowledge-bases/knowledge-base-access";

const db = getDb();

export async function createKnowledgeBase(args: {
  tenantId: string;
  createdByUserId: string;
  name: string;
  description?: string | null;
}): Promise<KnowledgeBase> {
  const description = args.description?.trim() || null;
  const [created] = await db
    .insert(knowledgeBases)
    .values({
      createdByUserId: args.createdByUserId,
      description,
      name: args.name.trim(),
      tenantId: args.tenantId,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create knowledge base"
    );
  }

  return created;
}

export type KnowledgeBaseListEntry = KnowledgeBase & {
  viewerRole: KnowledgeBaseViewerRole;
};

export async function listKnowledgeBasesForUser(args: {
  tenantId: string;
  userId: string;
}): Promise<KnowledgeBaseListEntry[]> {
  const rows = await db
    .select({
      knowledgeBase: knowledgeBases,
      memberRole: knowledgeBaseMembers.role,
    })
    .from(knowledgeBases)
    .leftJoin(
      knowledgeBaseMembers,
      and(
        eq(knowledgeBaseMembers.knowledgeBaseId, knowledgeBases.id),
        eq(knowledgeBaseMembers.userId, args.userId)
      )
    )
    .where(
      and(
        eq(knowledgeBases.tenantId, args.tenantId),
        isNull(knowledgeBases.channelChatId),
        or(
          eq(knowledgeBases.createdByUserId, args.userId),
          eq(knowledgeBaseMembers.userId, args.userId)
        )
      )
    )
    .orderBy(desc(knowledgeBases.updatedAt));

  return rows.map((row) => ({
    ...row.knowledgeBase,
    viewerRole:
      row.knowledgeBase.createdByUserId === args.userId
        ? "owner"
        : (row.memberRole ?? "viewer"),
  }));
}

export async function getKnowledgeBaseForUser(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
}): Promise<KnowledgeBase | null> {
  const access = await getKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return access?.knowledgeBase ?? null;
}

export type KnowledgeBaseSourceWithItem = KnowledgeBaseSource & {
  source: TeamSource;
};

export async function listKnowledgeBaseSources(args: {
  knowledgeBaseId: string;
}): Promise<KnowledgeBaseSourceWithItem[]> {
  const rows = await db
    .select({
      knowledgeBaseSource: knowledgeBaseSources,
      source: teamSources,
    })
    .from(knowledgeBaseSources)
    .innerJoin(
      teamSources,
      eq(knowledgeBaseSources.sourceItemId, teamSources.id)
    )
    .where(eq(knowledgeBaseSources.knowledgeBaseId, args.knowledgeBaseId))
    .orderBy(desc(knowledgeBaseSources.addedAt));

  return rows.map((row) => ({
    ...row.knowledgeBaseSource,
    source: row.source,
  }));
}

async function resolveSourceAcl(item: TeamSource) {
  if (item.accessControlList.length > 0) {
    return item.accessControlList;
  }
  return await buildKnowledgeItemAccessControlList(item);
}

async function assertUserCanAccessTeamSource(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
  sourceItemId: string;
}): Promise<TeamSource> {
  const [source] = await db
    .select()
    .from(teamSources)
    .where(
      and(
        eq(teamSources.id, args.sourceItemId),
        eq(teamSources.tenantId, args.tenantId)
      )
    )
    .limit(1);

  if (!source) {
    throw new ChatbotError("not_found:api", "Source not found");
  }

  const userAclTokens = await buildUserAclTokensFromMemberships({
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  if (
    !userCanAccessKnowledgeItem({
      item: source,
      userAclTokens,
      userEmail: args.userEmail,
      userId: args.userId,
    })
  ) {
    throw new ChatbotError("forbidden:api", "You cannot access this source");
  }

  return source;
}

function assertTeamSourceIsSearchable(source: TeamSource) {
  const hasContent = Boolean(source.content?.trim());
  const isIndexed = Boolean(source.lastIndexedAt);
  if (!hasContent && !isIndexed) {
    throw new ChatbotError(
      "bad_request:api",
      "Index this source in Sources before adding it to a knowledge base"
    );
  }
}

export async function indexTeamSourceInKnowledgeBase(args: {
  knowledgeBaseId: string;
  item: TeamSource;
}) {
  const acl = await resolveSourceAcl(args.item);
  const normalizedContent = args.item.content?.trim() || args.item.title.trim();
  const chunked = chunkText(normalizedContent);
  const chunks = (chunked.length > 0 ? chunked : [normalizedContent]).map(
    (content, index) => ({
      accessControlList: acl,
      blurb: content.slice(0, 240),
      chunkIndex: index,
      content,
      knowledgeBaseId: args.knowledgeBaseId,
      link: args.item.link ?? "",
      sourceConnectorType: args.item.sourceType,
      sourceItemId: args.item.id,
      tenantId: args.item.tenantId,
      title: args.item.title,
      updatedAt: args.item.sourceUpdatedAt ?? args.item.updatedAt,
    })
  );

  await deleteKnowledgeBaseSourceChunks({
    knowledgeBaseId: args.knowledgeBaseId,
    sourceItemId: args.item.id,
  });
  await bulkIndexKnowledgeBaseChunks(chunks);
}

export async function linkSourceToKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  sourceItemId: string;
  addedByUserId: string;
  userEmail: string;
}): Promise<KnowledgeBaseSourceWithItem> {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "editor",
    tenantId: args.tenantId,
    userId: args.addedByUserId,
  });

  const source = await assertUserCanAccessTeamSource({
    sourceItemId: args.sourceItemId,
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.addedByUserId,
  });
  assertTeamSourceIsSearchable(source);

  const [linked] = await db
    .insert(knowledgeBaseSources)
    .values({
      addedByUserId: args.addedByUserId,
      knowledgeBaseId: args.knowledgeBaseId,
      sourceItemId: args.sourceItemId,
    })
    .onConflictDoNothing()
    .returning();

  const knowledgeBaseSource =
    linked ??
    (
      await db
        .select()
        .from(knowledgeBaseSources)
        .where(
          and(
            eq(knowledgeBaseSources.knowledgeBaseId, args.knowledgeBaseId),
            eq(knowledgeBaseSources.sourceItemId, args.sourceItemId)
          )
        )
        .limit(1)
    ).at(0);

  if (!knowledgeBaseSource) {
    throw new ChatbotError("bad_request:database", "Failed to link source");
  }

  await indexTeamSourceInKnowledgeBase({
    item: source,
    knowledgeBaseId: args.knowledgeBaseId,
  });

  await db
    .update(knowledgeBases)
    .set({ updatedAt: new Date() })
    .where(eq(knowledgeBases.id, args.knowledgeBaseId));

  return { ...knowledgeBaseSource, source };
}

export async function removeSourceFromKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  sourceItemId: string;
  userId: string;
}) {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "editor",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  const [removed] = await db
    .delete(knowledgeBaseSources)
    .where(
      and(
        eq(knowledgeBaseSources.knowledgeBaseId, args.knowledgeBaseId),
        eq(knowledgeBaseSources.sourceItemId, args.sourceItemId)
      )
    )
    .returning();

  if (!removed) {
    throw new ChatbotError(
      "not_found:api",
      "Source is not linked to this knowledge base"
    );
  }

  await deleteKnowledgeBaseSourceChunks({
    knowledgeBaseId: args.knowledgeBaseId,
    sourceItemId: args.sourceItemId,
  });

  await db
    .update(knowledgeBases)
    .set({ updatedAt: new Date() })
    .where(eq(knowledgeBases.id, args.knowledgeBaseId));

  return removed;
}

export async function addUploadToKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  userEmail: string;
  title: string;
  fileName?: string;
  content: string;
}) {
  const item = await createTeamKbItem({
    createdByUserId: args.userId,
    input: {
      content: args.content,
      externalRef: args.fileName ?? null,
      knowledgeBaseId: args.knowledgeBaseId,
      sourceType: "upload",
      title: args.title,
      visibility: "private",
    },
    skipSearchIndex: true,
    tenantId: args.tenantId,
  });

  return linkSourceToKnowledgeBase({
    addedByUserId: args.userId,
    knowledgeBaseId: args.knowledgeBaseId,
    sourceItemId: item.id,
    tenantId: args.tenantId,
    userEmail: args.userEmail,
  });
}

export async function searchKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  query: string;
  limit?: number;
}) {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "viewer",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return hybridSearchKnowledgeBaseChunks({
    knowledgeBaseId: args.knowledgeBaseId,
    limit: args.limit,
    query: args.query,
    tenantId: args.tenantId,
  });
}

export async function updateKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  name?: string;
  description?: string | null;
}) {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "editor",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  const [updated] = await db
    .update(knowledgeBases)
    .set({
      ...(args.name === undefined ? {} : { name: args.name.trim() }),
      ...(args.description === undefined
        ? {}
        : { description: args.description?.trim() || null }),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBases.id, args.knowledgeBaseId))
    .returning();

  if (!updated) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update knowledge base"
    );
  }

  return updated;
}

export async function deleteKnowledgeBase(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
}): Promise<void> {
  const access = await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "owner",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (access.knowledgeBase.channelChatId) {
    throw new ChatbotError(
      "bad_request:api",
      "Channel knowledge bases are removed when the channel is deleted"
    );
  }

  const deleted = await db
    .delete(knowledgeBases)
    .where(eq(knowledgeBases.id, args.knowledgeBaseId))
    .returning({ id: knowledgeBases.id });

  if (deleted.length === 0) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete knowledge base"
    );
  }
}
