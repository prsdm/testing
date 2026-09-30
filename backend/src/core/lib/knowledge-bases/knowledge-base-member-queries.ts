import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  authUser,
  knowledgeBaseMembers,
  tenantMembers,
  tenants,
} from "@/core/lib/db/tables";
import { requireKnowledgeBaseAccess } from "@/core/lib/knowledge-bases/knowledge-base-access";
import { ChatbotError } from "@/shared/errors";
import type { KnowledgeBaseCollaboratorRole } from "@/shared/knowledge-bases/knowledge-base-access";

const db = getDb();

export type KnowledgeBaseMemberRow = {
  userId: string;
  role: KnowledgeBaseCollaboratorRole;
  email: string;
  displayName: string;
  image: string | null;
  createdAt: Date;
};

export type KnowledgeBaseMemberPickerRow = {
  userId: string;
  email: string;
  displayName: string;
  image: string | null;
};

function resolveDisplayName(args: {
  userName: string | null;
  email: string;
}): string {
  const trimmed = args.userName?.trim();
  if (trimmed) {
    return trimmed;
  }
  return args.email;
}

export async function listKnowledgeBaseMembers(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
}): Promise<KnowledgeBaseMemberRow[]> {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "viewer",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  const rows = await db
    .select({
      createdAt: knowledgeBaseMembers.createdAt,
      email: tenantMembers.email,
      image: authUser.image,
      role: knowledgeBaseMembers.role,
      userId: knowledgeBaseMembers.userId,
      userName: authUser.name,
    })
    .from(knowledgeBaseMembers)
    .innerJoin(authUser, eq(knowledgeBaseMembers.userId, authUser.id))
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.authUserId, knowledgeBaseMembers.userId),
        eq(tenantMembers.tenantId, args.tenantId)
      )
    )
    .where(eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId))
    .orderBy(asc(tenantMembers.email));

  return rows.map((row) => ({
    createdAt: row.createdAt,
    displayName: resolveDisplayName({
      email: row.email,
      userName: row.userName,
    }),
    email: row.email,
    image: row.image,
    role: row.role,
    userId: row.userId,
  }));
}

export async function listKnowledgeBaseMemberPickerOptions(args: {
  tenantId: string;
  knowledgeBaseId: string;
  ownerUserId: string;
  userId: string;
}): Promise<KnowledgeBaseMemberPickerRow[]> {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "owner",
    tenantId: args.tenantId,
    userId: args.userId,
  });

  const existingMemberRows = await db
    .select({ userId: knowledgeBaseMembers.userId })
    .from(knowledgeBaseMembers)
    .where(eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId));

  const excludedUserIds = new Set([
    args.ownerUserId,
    ...existingMemberRows.map((row) => row.userId),
  ]);

  const tenantMemberRows = await db
    .select({
      email: tenantMembers.email,
      image: authUser.image,
      isActive: tenantMembers.isActive,
      userId: tenantMembers.authUserId,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .where(eq(tenants.id, args.tenantId))
    .orderBy(asc(tenantMembers.email));

  return tenantMemberRows
    .filter((row) => row.isActive && !excludedUserIds.has(row.userId))
    .map((row) => ({
      displayName: resolveDisplayName({
        email: row.email,
        userName: row.userName,
      }),
      email: row.email,
      image: row.image,
      userId: row.userId,
    }));
}

async function assertTenantMemberUser(args: {
  tenantId: string;
  userId: string;
}) {
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.userId),
        eq(tenantMembers.isActive, true)
      )
    )
    .limit(1);

  if (!member) {
    throw new ChatbotError(
      "bad_request:api",
      "User is not an active workspace member"
    );
  }
}

export async function addKnowledgeBaseMember(args: {
  tenantId: string;
  knowledgeBaseId: string;
  actorUserId: string;
  memberUserId: string;
  role: KnowledgeBaseCollaboratorRole;
}) {
  const access = await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "owner",
    tenantId: args.tenantId,
    userId: args.actorUserId,
  });

  if (args.memberUserId === access.knowledgeBase.createdByUserId) {
    throw new ChatbotError(
      "bad_request:api",
      "The knowledge base owner already has access"
    );
  }

  await assertTenantMemberUser({
    tenantId: args.tenantId,
    userId: args.memberUserId,
  });

  const [created] = await db
    .insert(knowledgeBaseMembers)
    .values({
      addedByUserId: args.actorUserId,
      knowledgeBaseId: args.knowledgeBaseId,
      role: args.role,
      userId: args.memberUserId,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    throw new ChatbotError(
      "bad_request:api",
      "This member already has access to the knowledge base"
    );
  }

  return created;
}

export async function updateKnowledgeBaseMemberRole(args: {
  tenantId: string;
  knowledgeBaseId: string;
  actorUserId: string;
  memberUserId: string;
  role: KnowledgeBaseCollaboratorRole;
}) {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "owner",
    tenantId: args.tenantId,
    userId: args.actorUserId,
  });

  const [updated] = await db
    .update(knowledgeBaseMembers)
    .set({ role: args.role })
    .where(
      and(
        eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId),
        eq(knowledgeBaseMembers.userId, args.memberUserId)
      )
    )
    .returning();

  if (!updated) {
    throw new ChatbotError("not_found:api", "Knowledge base member not found");
  }

  return updated;
}

export async function removeKnowledgeBaseMember(args: {
  tenantId: string;
  knowledgeBaseId: string;
  actorUserId: string;
  memberUserId: string;
}) {
  await requireKnowledgeBaseAccess({
    knowledgeBaseId: args.knowledgeBaseId,
    minimumRole: "owner",
    tenantId: args.tenantId,
    userId: args.actorUserId,
  });

  const [removed] = await db
    .delete(knowledgeBaseMembers)
    .where(
      and(
        eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId),
        eq(knowledgeBaseMembers.userId, args.memberUserId)
      )
    )
    .returning();

  if (!removed) {
    throw new ChatbotError("not_found:api", "Knowledge base member not found");
  }

  return removed;
}
