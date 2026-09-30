import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  deleteTeamKbItemFromSearch,
  indexTeamKbItemInSearch,
} from "@/core/lib/sources/source-chunk-index";
import {
  parseSourceExternalAccess,
  type SourceExternalAccess,
} from "@/core/lib/sources/source-external-access";
import { refreshKnowledgeItemAccessControlList } from "@/core/lib/sources/source-item-acl";
import { ChatbotError } from "@/shared/errors";
import type {
  SourceAccessRole,
  SourceConnectorType,
  SourceVisibility,
} from "@/shared/sources/source-types";
import { getDb } from "./client";
import {
  authUser,
  type PersonalSource,
  personalSources,
  sourceAccessGrants,
  type TeamSource,
  teamSources,
} from "./tables";

const db = getDb();

function getErrorDetail(error: unknown, fallback: string) {
  if (error instanceof ChatbotError && typeof error.cause === "string") {
    const cause = error.cause.trim();
    if (cause) {
      return cause;
    }
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }
  return fallback;
}

export type {
  SourceAccessRole,
  SourceConnectorType,
  SourceVisibility,
} from "@/shared/sources/source-types";

const EXTERNAL_ACL_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
]);

export type CreateKbItemInput = {
  title: string;
  content?: string;
  sourceType?: SourceConnectorType;
  visibility?: SourceVisibility;
  externalRef?: string | null;
  link?: string | null;
  sourceUpdatedAt?: Date | null;
  lastIndexedAt?: Date | null;
  sourceExternalAccess?: SourceExternalAccess | null;
  knowledgeBaseId?: string | null;
};

function escapeIlikePattern(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

async function ensureKnowledgeGrant(args: {
  tenantId: string;
  sourceItemId: string;
  principalType: "user" | "tenant";
  principalId: string | null;
  role: SourceAccessRole;
  grantedByUserId: string | null;
}) {
  const [existing] = await db
    .select({ id: sourceAccessGrants.id })
    .from(sourceAccessGrants)
    .where(
      and(
        eq(sourceAccessGrants.tenantId, args.tenantId),
        eq(sourceAccessGrants.sourceItemId, args.sourceItemId),
        eq(sourceAccessGrants.principalType, args.principalType),
        args.principalId === null
          ? sql`${sourceAccessGrants.principalId} IS NULL`
          : eq(sourceAccessGrants.principalId, args.principalId),
        eq(sourceAccessGrants.role, args.role)
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(sourceAccessGrants).values({
    grantedByUserId: args.grantedByUserId,
    principalId: args.principalId,
    principalType: args.principalType,
    role: args.role,
    sourceItemId: args.sourceItemId,
    tenantId: args.tenantId,
    updatedAt: new Date(),
  });
}

async function syncKnowledgeVisibilityGrants(args: {
  tenantId: string;
  sourceItemId: string;
  visibility: SourceVisibility;
  sourceType: SourceConnectorType;
  sourceExternalAccess: unknown;
  ownerUserId: string | null;
}) {
  if (args.ownerUserId) {
    await ensureKnowledgeGrant({
      grantedByUserId: args.ownerUserId,
      principalId: args.ownerUserId,
      principalType: "user",
      role: "owner",
      sourceItemId: args.sourceItemId,
      tenantId: args.tenantId,
    });
  }

  const parsedExternalAccess = parseSourceExternalAccess(
    args.sourceExternalAccess
  );
  const shouldGrantTenantViewer =
    args.visibility === "shared" &&
    (!EXTERNAL_ACL_SOURCE_TYPES.has(args.sourceType) ||
      parsedExternalAccess?.isTenantPublic === true);

  if (shouldGrantTenantViewer) {
    await ensureKnowledgeGrant({
      grantedByUserId: args.ownerUserId,
      principalId: null,
      principalType: "tenant",
      role: "viewer",
      sourceItemId: args.sourceItemId,
      tenantId: args.tenantId,
    });
    return;
  }

  await db
    .delete(sourceAccessGrants)
    .where(
      and(
        eq(sourceAccessGrants.tenantId, args.tenantId),
        eq(sourceAccessGrants.sourceItemId, args.sourceItemId),
        eq(sourceAccessGrants.principalType, "tenant"),
        sql`${sourceAccessGrants.principalId} IS NULL`,
        eq(sourceAccessGrants.role, "viewer")
      )
    );
}

export { repairExternalConnectorBroadGrants } from "@/core/lib/sources/repair-broad-grants";

async function indexTeamKbItemInSearchWithAcl(item: TeamSource) {
  const accessControlList = await refreshKnowledgeItemAccessControlList({
    createdByUserId: item.createdByUserId,
    id: item.id,
    sourceExternalAccess: item.sourceExternalAccess,
    sourceType: item.sourceType,
    tenantId: item.tenantId,
    visibility: item.visibility,
  });
  await indexTeamKbItemInSearch({
    ...item,
    accessControlList,
  });
}

export async function listPersonalKbItems(args: {
  tenantId: string;
  authUserId: string;
  limit?: number;
}): Promise<PersonalSource[]> {
  const limit = args.limit ?? 100;
  try {
    return await db
      .select()
      .from(personalSources)
      .where(
        and(
          eq(personalSources.tenantId, args.tenantId),
          eq(personalSources.authUserId, args.authUserId)
        )
      )
      .orderBy(desc(personalSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list personal KB items"
    );
  }
}

export async function searchPersonalKbItems(args: {
  tenantId: string;
  authUserId: string;
  query: string;
  limit?: number;
}): Promise<PersonalSource[]> {
  const trimmed = args.query.trim();
  if (!trimmed) {
    return [];
  }

  const pattern = `%${escapeIlikePattern(trimmed)}%`;
  const limit = args.limit ?? 8;

  try {
    return await db
      .select()
      .from(personalSources)
      .where(
        and(
          eq(personalSources.tenantId, args.tenantId),
          eq(personalSources.authUserId, args.authUserId),
          or(
            ilike(personalSources.title, pattern),
            ilike(personalSources.content, pattern)
          )
        )
      )
      .orderBy(desc(personalSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to search personal KB items"
    );
  }
}

export async function createPersonalKbItem(args: {
  tenantId: string;
  authUserId: string;
  input: CreateKbItemInput;
}): Promise<PersonalSource> {
  try {
    const [created] = await db
      .insert(personalSources)
      .values({
        authUserId: args.authUserId,
        content: args.input.content?.trim() ?? "",
        externalRef: args.input.externalRef ?? null,
        link: args.input.link ?? null,
        sourceType: args.input.sourceType ?? "manual",
        tenantId: args.tenantId,
        title: args.input.title.trim(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to create personal KB item"
    );
  }
}

export async function upsertPersonalKbDriveItem(args: {
  tenantId: string;
  authUserId: string;
  input: CreateKbItemInput & { externalRef: string };
}): Promise<PersonalSource> {
  try {
    const [existing] = await db
      .select()
      .from(personalSources)
      .where(
        and(
          eq(personalSources.tenantId, args.tenantId),
          eq(personalSources.authUserId, args.authUserId),
          eq(personalSources.externalRef, args.input.externalRef),
          eq(personalSources.sourceType, "drive")
        )
      )
      .limit(1);

    const values = {
      content: args.input.content?.trim() ?? "",
      link: args.input.link ?? null,
      title: args.input.title.trim(),
      updatedAt: new Date(),
    };

    if (existing) {
      const [updated] = await db
        .update(personalSources)
        .set(values)
        .where(eq(personalSources.id, existing.id))
        .returning();
      return updated;
    }

    return createPersonalKbItem({
      authUserId: args.authUserId,
      input: { ...args.input, sourceType: "drive" },
      tenantId: args.tenantId,
    });
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to upsert personal Drive KB item"
    );
  }
}

export async function deletePersonalKbItem(args: {
  tenantId: string;
  authUserId: string;
  itemId: string;
}): Promise<boolean> {
  try {
    const deleted = await db
      .delete(personalSources)
      .where(
        and(
          eq(personalSources.id, args.itemId),
          eq(personalSources.tenantId, args.tenantId),
          eq(personalSources.authUserId, args.authUserId)
        )
      )
      .returning({ id: personalSources.id });
    return deleted.length > 0;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to delete personal KB item"
    );
  }
}

export async function listTeamKbItems(args: {
  tenantId: string;
  limit?: number;
}): Promise<TeamSource[]> {
  const limit = args.limit ?? 100;
  try {
    return await db
      .select()
      .from(teamSources)
      .where(eq(teamSources.tenantId, args.tenantId))
      .orderBy(desc(teamSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list team KB items"
    );
  }
}

export const KB_LIST_DEFAULT_PAGE_SIZE = 50;
export const KB_LIST_MAX_PAGE_SIZE = 100;

export type TeamSourceListRow = {
  id: string;
  tenantId: string;
  title: string;
  sourceType: SourceConnectorType;
  visibility: SourceVisibility;
  externalRef: string | null;
  link: string | null;
  sourceUpdatedAt: Date | null;
  lastIndexedAt: Date | null;
  sourceExternalAccess: unknown;
  accessControlList: string[];
  createdByUserId: string | null;
  indexedByEmail: string | null;
  indexedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const CONNECTOR_KB_SOURCE_TYPES: SourceConnectorType[] = [
  "drive",
  "confluence",
  "notion",
  "sharepoint",
];
const NON_CONNECTOR_KB_SOURCE_TYPES: SourceConnectorType[] = [
  "manual",
  "upload",
];

function buildUserAclTokensSql(userAclTokens: string[]) {
  if (userAclTokens.length === 0) {
    return sql`'{}'::text[]`;
  }
  return sql`ARRAY[${sql.join(
    userAclTokens.map((token) => sql`${token}`),
    sql`, `
  )}]::text[]`;
}

export async function listTeamKbItemsForTenant(args: {
  tenantId: string;
  limit?: number;
}): Promise<TeamSource[]> {
  const limit = args.limit ?? 100;
  try {
    return await db
      .select()
      .from(teamSources)
      .where(eq(teamSources.tenantId, args.tenantId))
      .orderBy(desc(teamSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list knowledge items"
    );
  }
}

export async function listTeamKbItemsMetadataPage(args: {
  tenantId: string;
  page: number;
  limit: number;
}): Promise<TeamSourceListRow[]> {
  const offset = (args.page - 1) * args.limit;
  try {
    return await db
      .select({
        accessControlList: teamSources.accessControlList,
        createdAt: teamSources.createdAt,
        createdByUserId: teamSources.createdByUserId,
        externalRef: teamSources.externalRef,
        id: teamSources.id,
        indexedByEmail: authUser.email,
        indexedByName: authUser.name,
        lastIndexedAt: teamSources.lastIndexedAt,
        link: teamSources.link,
        sourceExternalAccess: teamSources.sourceExternalAccess,
        sourceType: teamSources.sourceType,
        sourceUpdatedAt: teamSources.sourceUpdatedAt,
        tenantId: teamSources.tenantId,
        title: teamSources.title,
        updatedAt: teamSources.updatedAt,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .leftJoin(authUser, eq(teamSources.createdByUserId, authUser.id))
      .where(eq(teamSources.tenantId, args.tenantId))
      .orderBy(desc(teamSources.updatedAt))
      .limit(args.limit)
      .offset(offset);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list knowledge item metadata"
    );
  }
}

export async function listVisibleTeamKbItemsMetadataPage(args: {
  tenantId: string;
  userId: string;
  userAclTokens: string[];
  page: number;
  limit: number;
}): Promise<TeamSourceListRow[]> {
  const offset = (args.page - 1) * args.limit;
  const userTokensSql = buildUserAclTokensSql(args.userAclTokens);
  try {
    return await db
      .select({
        accessControlList: teamSources.accessControlList,
        createdAt: teamSources.createdAt,
        createdByUserId: teamSources.createdByUserId,
        externalRef: teamSources.externalRef,
        id: teamSources.id,
        indexedByEmail: authUser.email,
        indexedByName: authUser.name,
        lastIndexedAt: teamSources.lastIndexedAt,
        link: teamSources.link,
        sourceExternalAccess: teamSources.sourceExternalAccess,
        sourceType: teamSources.sourceType,
        sourceUpdatedAt: teamSources.sourceUpdatedAt,
        tenantId: teamSources.tenantId,
        title: teamSources.title,
        updatedAt: teamSources.updatedAt,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .leftJoin(authUser, eq(teamSources.createdByUserId, authUser.id))
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          isNull(teamSources.knowledgeBaseId),
          or(
            // Manual / upload: owner always; shared only with ACL overlap.
            and(
              inArray(teamSources.sourceType, NON_CONNECTOR_KB_SOURCE_TYPES),
              or(
                eq(teamSources.createdByUserId, args.userId),
                and(
                  eq(teamSources.visibility, "shared"),
                  sql`${teamSources.accessControlList} && ${userTokensSql}`
                )
              )
            ),
            // Connector sources: private for owner; shared only with ACL overlap.
            // Empty ACL fails closed (no longer visible to everyone).
            and(
              inArray(teamSources.sourceType, CONNECTOR_KB_SOURCE_TYPES),
              or(
                and(
                  eq(teamSources.visibility, "private"),
                  eq(teamSources.createdByUserId, args.userId)
                ),
                and(
                  eq(teamSources.visibility, "shared"),
                  sql`${teamSources.accessControlList} && ${userTokensSql}`
                )
              )
            )
          )
        )
      )
      .orderBy(desc(teamSources.updatedAt))
      .limit(args.limit)
      .offset(offset);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list visible knowledge item metadata"
    );
  }
}

export async function searchTeamKbItems(args: {
  tenantId: string;
  query: string;
  limit?: number;
}): Promise<TeamSource[]> {
  const trimmed = args.query.trim();
  if (!trimmed) {
    return [];
  }

  const pattern = `%${escapeIlikePattern(trimmed)}%`;
  const limit = args.limit ?? 8;

  try {
    return await db
      .select()
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          or(
            ilike(teamSources.title, pattern),
            ilike(teamSources.content, pattern)
          )
        )
      )
      .orderBy(desc(teamSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to search team KB items"
    );
  }
}

export async function createTeamKbItem(args: {
  tenantId: string;
  createdByUserId: string;
  input: CreateKbItemInput;
  skipSearchIndex?: boolean;
}): Promise<TeamSource> {
  const run = async () => {
    const visibility =
      args.input.visibility ??
      (args.input.sourceType === "drive" ? "shared" : "private");
    const now = new Date();

    const [created] = await db
      .insert(teamSources)
      .values({
        content: args.input.content?.trim() ?? "",
        createdByUserId: args.createdByUserId,
        externalRef: args.input.externalRef ?? null,
        knowledgeBaseId: args.input.knowledgeBaseId ?? null,
        lastIndexedAt: args.input.lastIndexedAt ?? null,
        link: args.input.link ?? null,
        sourceExternalAccess: args.input.sourceExternalAccess ?? null,
        sourceType: args.input.sourceType ?? "manual",
        sourceUpdatedAt: args.input.sourceUpdatedAt ?? null,
        tenantId: args.tenantId,
        title: args.input.title.trim(),
        updatedAt: now,
        visibility,
      })
      .returning();
    await syncKnowledgeVisibilityGrants({
      ownerUserId: created.createdByUserId,
      sourceExternalAccess: created.sourceExternalAccess,
      sourceItemId: created.id,
      sourceType: created.sourceType,
      tenantId: args.tenantId,
      visibility: created.visibility,
    });
    if (!args.skipSearchIndex) {
      await indexTeamKbItemInSearchWithAcl(created);
    }
    return created;
  };

  try {
    return await run();
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to create team KB item")
    );
  }
}

export async function getTeamKbSourceExternalAccessByIds(args: {
  tenantId: string;
  itemIds: string[];
}): Promise<Map<string, SourceExternalAccess | null>> {
  const uniqueIds = [...new Set(args.itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      id: teamSources.id,
      sourceExternalAccess: teamSources.sourceExternalAccess,
    })
    .from(teamSources)
    .where(
      and(
        eq(teamSources.tenantId, args.tenantId),
        inArray(teamSources.id, uniqueIds)
      )
    );

  return new Map(
    rows.map((row) => [
      row.id,
      parseSourceExternalAccess(row.sourceExternalAccess),
    ])
  );
}

export async function upsertTeamKbDriveItem(args: {
  tenantId: string;
  createdByUserId: string;
  input: CreateKbItemInput & { externalRef: string };
}): Promise<TeamSource> {
  const run = async () => {
    const [existing] = await db
      .select({
        createdByUserId: teamSources.createdByUserId,
        id: teamSources.id,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.externalRef, args.input.externalRef),
          eq(teamSources.sourceType, "drive")
        )
      )
      .limit(1);

    const values = {
      content: args.input.content?.trim() ?? "",
      link: args.input.link ?? null,
      title: args.input.title.trim(),
      updatedAt: new Date(),
      visibility: (args.input.visibility ??
        existing?.visibility ??
        "shared") as SourceVisibility,
      ...(args.input.sourceExternalAccess === undefined
        ? {}
        : { sourceExternalAccess: args.input.sourceExternalAccess }),
    };

    if (existing) {
      const [updated] = await db
        .update(teamSources)
        .set(values)
        .where(eq(teamSources.id, existing.id))
        .returning();
      await syncKnowledgeVisibilityGrants({
        ownerUserId: updated.createdByUserId,
        sourceExternalAccess: updated.sourceExternalAccess,
        sourceItemId: updated.id,
        sourceType: updated.sourceType,
        tenantId: args.tenantId,
        visibility: updated.visibility,
      });
      await indexTeamKbItemInSearchWithAcl(updated);
      return updated;
    }

    return createTeamKbItem({
      createdByUserId: args.createdByUserId,
      input: { ...args.input, sourceType: "drive", visibility: "shared" },
      tenantId: args.tenantId,
    });
  };

  try {
    return await run();
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to upsert team Drive KB item")
    );
  }
}

export async function upsertTeamKbConfluenceItem(args: {
  tenantId: string;
  createdByUserId: string;
  input: CreateKbItemInput & { externalRef: string };
}): Promise<TeamSource> {
  const run = async () => {
    const [existing] = await db
      .select({
        createdByUserId: teamSources.createdByUserId,
        id: teamSources.id,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.externalRef, args.input.externalRef),
          eq(teamSources.sourceType, "confluence")
        )
      )
      .limit(1);

    const values = {
      content: args.input.content?.trim() ?? "",
      link: args.input.link ?? null,
      title: args.input.title.trim(),
      updatedAt: new Date(),
      visibility: (args.input.visibility ??
        existing?.visibility ??
        "shared") as SourceVisibility,
      ...(args.input.sourceExternalAccess === undefined
        ? {}
        : { sourceExternalAccess: args.input.sourceExternalAccess }),
    };

    if (existing) {
      const [updated] = await db
        .update(teamSources)
        .set(values)
        .where(eq(teamSources.id, existing.id))
        .returning();
      await syncKnowledgeVisibilityGrants({
        ownerUserId: updated.createdByUserId,
        sourceExternalAccess: updated.sourceExternalAccess,
        sourceItemId: updated.id,
        sourceType: updated.sourceType,
        tenantId: args.tenantId,
        visibility: updated.visibility,
      });
      await indexTeamKbItemInSearchWithAcl(updated);
      return updated;
    }

    return createTeamKbItem({
      createdByUserId: args.createdByUserId,
      input: { ...args.input, sourceType: "confluence", visibility: "shared" },
      tenantId: args.tenantId,
    });
  };

  try {
    return await run();
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to upsert team Confluence KB item")
    );
  }
}

export async function getTeamKbNotionItemByExternalRef(args: {
  tenantId: string;
  externalRef: string;
}) {
  const [existing] = await db
    .select({
      createdByUserId: teamSources.createdByUserId,
      sourceExternalAccess: teamSources.sourceExternalAccess,
    })
    .from(teamSources)
    .where(
      and(
        eq(teamSources.tenantId, args.tenantId),
        eq(teamSources.externalRef, args.externalRef),
        eq(teamSources.sourceType, "notion")
      )
    )
    .limit(1);
  return existing ?? null;
}

export async function upsertTeamKbNotionItem(args: {
  tenantId: string;
  createdByUserId: string;
  input: CreateKbItemInput & { externalRef: string };
}): Promise<TeamSource> {
  const run = async () => {
    const [existing] = await db
      .select({
        createdByUserId: teamSources.createdByUserId,
        id: teamSources.id,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.externalRef, args.input.externalRef),
          eq(teamSources.sourceType, "notion")
        )
      )
      .limit(1);

    const values = {
      content: args.input.content?.trim() ?? "",
      link: args.input.link ?? null,
      title: args.input.title.trim(),
      updatedAt: new Date(),
      visibility: (args.input.visibility ??
        existing?.visibility ??
        "shared") as SourceVisibility,
      ...(args.input.sourceExternalAccess === undefined
        ? {}
        : { sourceExternalAccess: args.input.sourceExternalAccess }),
    };

    if (existing) {
      const [updated] = await db
        .update(teamSources)
        .set(values)
        .where(eq(teamSources.id, existing.id))
        .returning();
      await syncKnowledgeVisibilityGrants({
        ownerUserId: updated.createdByUserId,
        sourceExternalAccess: updated.sourceExternalAccess,
        sourceItemId: updated.id,
        sourceType: updated.sourceType,
        tenantId: args.tenantId,
        visibility: updated.visibility,
      });
      await indexTeamKbItemInSearchWithAcl(updated);
      return updated;
    }

    return createTeamKbItem({
      createdByUserId: args.createdByUserId,
      input: { ...args.input, sourceType: "notion", visibility: "shared" },
      tenantId: args.tenantId,
    });
  };

  try {
    return await run();
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to upsert team Notion KB item")
    );
  }
}

export async function upsertTeamKbSharePointItem(args: {
  tenantId: string;
  createdByUserId: string;
  input: CreateKbItemInput & { externalRef: string };
}): Promise<TeamSource> {
  const run = async () => {
    const [existing] = await db
      .select({
        createdByUserId: teamSources.createdByUserId,
        id: teamSources.id,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.externalRef, args.input.externalRef),
          eq(teamSources.sourceType, "sharepoint")
        )
      )
      .limit(1);

    const values = {
      content: args.input.content?.trim() ?? "",
      link: args.input.link ?? null,
      title: args.input.title.trim(),
      updatedAt: new Date(),
      visibility: (args.input.visibility ??
        existing?.visibility ??
        "shared") as SourceVisibility,
      ...(args.input.sourceExternalAccess === undefined
        ? {}
        : { sourceExternalAccess: args.input.sourceExternalAccess }),
    };

    if (existing) {
      const [updated] = await db
        .update(teamSources)
        .set(values)
        .where(eq(teamSources.id, existing.id))
        .returning();
      await syncKnowledgeVisibilityGrants({
        ownerUserId: updated.createdByUserId,
        sourceExternalAccess: updated.sourceExternalAccess,
        sourceItemId: updated.id,
        sourceType: updated.sourceType,
        tenantId: args.tenantId,
        visibility: updated.visibility,
      });
      await indexTeamKbItemInSearchWithAcl(updated);
      return updated;
    }

    return createTeamKbItem({
      createdByUserId: args.createdByUserId,
      input: { ...args.input, sourceType: "sharepoint", visibility: "shared" },
      tenantId: args.tenantId,
    });
  };

  try {
    return await run();
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to upsert team SharePoint KB item")
    );
  }
}

export async function deleteTeamKbItem(args: {
  tenantId: string;
  itemId: string;
  createdByUserId?: string;
}): Promise<boolean> {
  try {
    if (args.createdByUserId) {
      const [ownerGrant] = await db
        .select({ id: sourceAccessGrants.id })
        .from(sourceAccessGrants)
        .where(
          and(
            eq(sourceAccessGrants.tenantId, args.tenantId),
            eq(sourceAccessGrants.sourceItemId, args.itemId),
            eq(sourceAccessGrants.principalType, "user"),
            eq(sourceAccessGrants.principalId, args.createdByUserId),
            eq(sourceAccessGrants.role, "owner")
          )
        )
        .limit(1);
      if (!ownerGrant) {
        return false;
      }
    }

    await deleteTeamKbItemFromSearch({
      itemId: args.itemId,
      tenantId: args.tenantId,
    });

    const deleted = await db
      .delete(teamSources)
      .where(
        and(
          eq(teamSources.id, args.itemId),
          eq(teamSources.tenantId, args.tenantId),
          args.createdByUserId
            ? eq(teamSources.createdByUserId, args.createdByUserId)
            : undefined
        )
      )
      .returning({ id: teamSources.id });
    return deleted.length > 0;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to delete team KB item"
    );
  }
}

export async function listDriveTeamKbItemsForAutoIndex(args: {
  tenantId: string;
  userId: string;
  limit?: number;
}): Promise<TeamSource[]> {
  const limit = args.limit ?? 50;
  try {
    return await db
      .selectDistinct({
        accessControlList: teamSources.accessControlList,
        content: teamSources.content,
        createdAt: teamSources.createdAt,
        createdByUserId: teamSources.createdByUserId,
        externalRef: teamSources.externalRef,
        id: teamSources.id,
        knowledgeBaseId: teamSources.knowledgeBaseId,
        lastIndexedAt: sql<Date | null>`${teamSources.updatedAt}`,
        link: teamSources.link,
        sourceExternalAccess: teamSources.sourceExternalAccess,
        sourceType: teamSources.sourceType,
        sourceUpdatedAt: sql<Date | null>`${teamSources.updatedAt}`,
        tenantId: teamSources.tenantId,
        title: teamSources.title,
        updatedAt: teamSources.updatedAt,
        visibility: teamSources.visibility,
      })
      .from(teamSources)
      .innerJoin(
        sourceAccessGrants,
        eq(sourceAccessGrants.sourceItemId, teamSources.id)
      )
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.sourceType, "drive"),
          eq(sourceAccessGrants.tenantId, args.tenantId),
          or(
            and(
              eq(sourceAccessGrants.principalType, "user"),
              eq(sourceAccessGrants.principalId, args.userId)
            ),
            and(
              eq(sourceAccessGrants.principalType, "tenant"),
              sql`${sourceAccessGrants.principalId} IS NULL`
            )
          )
        )
      )
      .orderBy(desc(teamSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list Drive knowledge items for auto-index"
    );
  }
}

const ACL_REFRESH_SOURCE_TYPES: SourceConnectorType[] = [
  "drive",
  "confluence",
  "sharepoint",
];

export async function listTeamKbItemsForAclRefresh(args: {
  tenantId: string;
  limit?: number;
}): Promise<TeamSource[]> {
  const limit = args.limit ?? 50;
  try {
    return await db
      .select()
      .from(teamSources)
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          inArray(teamSources.sourceType, ACL_REFRESH_SOURCE_TYPES)
        )
      )
      .orderBy(asc(teamSources.updatedAt))
      .limit(limit);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to list team KB items for ACL refresh")
    );
  }
}

export async function updateTeamKbItemSourceExternalAccess(args: {
  tenantId: string;
  itemId: string;
  sourceExternalAccess: SourceExternalAccess;
  aclChanged: boolean;
}): Promise<TeamSource | null> {
  try {
    const [updated] = await db
      .update(teamSources)
      .set({
        ...(args.aclChanged
          ? { sourceExternalAccess: args.sourceExternalAccess }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(teamSources.tenantId, args.tenantId),
          eq(teamSources.id, args.itemId)
        )
      )
      .returning();

    if (!updated) {
      return null;
    }

    if (args.aclChanged) {
      await syncKnowledgeVisibilityGrants({
        ownerUserId: updated.createdByUserId,
        sourceExternalAccess: updated.sourceExternalAccess,
        sourceItemId: updated.id,
        sourceType: updated.sourceType,
        tenantId: args.tenantId,
        visibility: updated.visibility,
      });
      await indexTeamKbItemInSearchWithAcl(updated);
    }

    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      getErrorDetail(error, "Failed to update team KB item ACL")
    );
  }
}

export async function countIndexedKbSourcesByType(args: {
  tenantId: string;
}): Promise<Record<SourceConnectorType, number>> {
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      sourceType: teamSources.sourceType,
    })
    .from(teamSources)
    .where(eq(teamSources.tenantId, args.tenantId))
    .groupBy(teamSources.sourceType);

  const counts: Record<SourceConnectorType, number> = {
    confluence: 0,
    drive: 0,
    manual: 0,
    notion: 0,
    sharepoint: 0,
    slack: 0,
    upload: 0,
  };

  for (const row of rows) {
    counts[row.sourceType] = row.count;
  }

  return counts;
}
