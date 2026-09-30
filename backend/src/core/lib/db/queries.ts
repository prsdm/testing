import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import type { ArtifactKind } from "@/contracts/artifact";
import { sealOidcConfigJson } from "@/core/lib/auth/oidc-config-seal";
import { ACTIVE_TENANT_COOKIE } from "@/core/lib/tenant/active-tenant";
import { ChatbotError } from "@/shared/errors";
import { providerRouteIdById } from "@/shared/sso/providers";
import type { TenantMemberRole } from "@/shared/users/tenant-member-role";
import { generateUUID } from "@/shared/utils";
import { decryptSecret, encryptSecret, hashToken } from "../security/crypto";
import { encryptDirectoryCredentialsForStorage } from "../security/directory-secrets";
import { getDb } from "./client";
import {
  authAccount,
  authSsoProvider,
  authUser,
  type Chat,
  chat,
  chatUser,
  chatWorkflowRuns,
  type DBMessage,
  document,
  message,
  messageReaction,
  type peopleSyncRunStatusEnum,
  type peopleSyncSourceEnum,
  type peopleSyncStatusEnum,
  type Suggestion,
  securityAuditEvents,
  stream,
  suggestion,
  type Tenant,
  tenantAdminContacts,
  tenantDomains,
  tenantIdentities,
  tenantMembers,
  tenantPeople,
  tenantPeopleSyncIssues,
  tenantPeopleSyncRuns,
  tenantSetupTokens,
  tenantSsoConfigs,
  tenants,
  toolExecutionLedger,
  vote,
} from "./tables";

const baseDb = getDb();
type AppDb = typeof baseDb;
type AppDbTransaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
const tenantDbContext = new AsyncLocalStorage<{
  db: AppDb | AppDbTransaction;
  tenantId: string;
}>();
const tenantIdByUserId = new Map<
  string,
  { tenantId: string; expiresAt: number }
>();
const tenantUserWarmByUserId = new Map<string, number>();
const tenantIdResolveInflightByUserId = new Map<
  string,
  Promise<string | null>
>();
const tenantUserWarmInflightByUserId = new Map<string, Promise<void>>();
const TENANT_ID_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_USER_WARM_TTL_MS = 5 * 60 * 1000;
const tenantAccessContextByEmail = new Map<
  string,
  {
    value: {
      tenantId: string;
      tenantSlug: string;
      personStatus: (typeof peopleSyncStatusEnum.enumValues)[number] | null;
      personOrgUnit: string | null;
      allowedOrgUnits: string[];
    } | null;
    expiresAt: number;
  }
>();
const TENANT_ACCESS_CONTEXT_CACHE_TTL_MS = 60 * 1000;

function invalidateTenantAccessContextCacheForEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  for (const key of tenantAccessContextByEmail.keys()) {
    if (key === normalized || key.startsWith(`${normalized}:`)) {
      tenantAccessContextByEmail.delete(key);
    }
  }
}

/** Clear in-process tenant access snapshot after membership/person changes. */
export function clearTenantAccessContextCacheForEmail(email: string) {
  invalidateTenantAccessContextCacheForEmail(email);
}

function invalidateTenantAccessContextCacheForTenant(tenantId: string) {
  for (const [email, entry] of tenantAccessContextByEmail.entries()) {
    if (entry.value?.tenantId === tenantId) {
      tenantAccessContextByEmail.delete(email);
    }
  }
}

const db = new Proxy(baseDb, {
  get(_target, property) {
    const activeDb = tenantDbContext.getStore()?.db;
    if (!activeDb) {
      throw new ChatbotError(
        "bad_request:database",
        "Tenant context missing for database operation"
      );
    }
    const value = Reflect.get(activeDb, property, activeDb);

    if (typeof value === "function") {
      return value.bind(activeDb);
    }

    return value;
  },
});

function requireActiveTenantId(): string {
  const ctx = tenantDbContext.getStore();
  if (!ctx?.tenantId) {
    throw new ChatbotError(
      "bad_request:database",
      "Tenant context missing for database operation"
    );
  }
  return ctx.tenantId;
}

async function getTenantIdByDomain(domain: string): Promise<string | null> {
  const [record] = await baseDb
    .select({ tenantId: tenants.id })
    .from(tenantDomains)
    .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
    .where(and(eq(tenantDomains.domain, domain), eq(tenants.status, "active")))
    .limit(1);

  return record?.tenantId ?? null;
}

async function readPreferredTenantSlug(): Promise<string | null> {
  try {
    const { requestCookies } = await import("@/core/lib/http/request-context");
    return requestCookies().get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

async function listMembershipTenantRows(authUserId: string) {
  return await baseDb
    .select({
      slug: tenants.slug,
      tenantId: tenants.id,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(
      and(
        eq(tenantMembers.authUserId, authUserId),
        eq(tenantMembers.isActive, true),
        eq(tenants.status, "active")
      )
    )
    .orderBy(asc(tenantMembers.createdAt));
}

async function resolveTenantIdForUser(
  userId: string,
  email: string | null | undefined
): Promise<string | null> {
  const preferredSlug = await readPreferredTenantSlug();
  const memberships = await listMembershipTenantRows(userId);

  if (preferredSlug) {
    const preferred = memberships.find((row) => row.slug === preferredSlug);
    if (preferred) {
      return preferred.tenantId;
    }
  }

  const domain = email?.split("@")[1]?.toLowerCase();
  if (domain && memberships.length > 0) {
    const domainTenantId = await getTenantIdByDomain(domain);
    if (
      domainTenantId &&
      memberships.some((row) => row.tenantId === domainTenantId)
    ) {
      return domainTenantId;
    }
  }

  if (memberships[0]) {
    return memberships[0].tenantId;
  }

  if (domain) {
    const tenantId = await getTenantIdByDomain(domain);
    if (tenantId) {
      return tenantId;
    }
  }

  const [accountMappedTenant] = await baseDb
    .select({
      domain: authSsoProvider.domain,
    })
    .from(authAccount)
    .innerJoin(
      authSsoProvider,
      eq(authAccount.providerId, authSsoProvider.providerId)
    )
    .where(eq(authAccount.userId, userId))
    .limit(1);

  if (accountMappedTenant?.domain) {
    return await getTenantIdByDomain(accountMappedTenant.domain);
  }
  return null;
}

/** Drop cached ALS tenant id after active-workspace switch. */
export function clearTenantIdCacheForUser(userId: string) {
  for (const key of tenantIdByUserId.keys()) {
    if (key === userId || key.startsWith(`${userId}:`)) {
      tenantIdByUserId.delete(key);
    }
  }
  tenantIdResolveInflightByUserId.delete(userId);
  for (const key of tenantIdResolveInflightByUserId.keys()) {
    if (key.startsWith(`${userId}:`)) {
      tenantIdResolveInflightByUserId.delete(key);
    }
  }
}

export function toTenantUserId(authUserId: string) {
  const hex = createHash("sha256")
    .update(authUserId)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}

export async function withTenantForUser<T>(
  user: { id: string; email?: string | null } | null | undefined,
  fn: () => Promise<T>
) {
  if (!user?.id) {
    return fn();
  }

  const preferredSlug = await readPreferredTenantSlug();
  const cacheKey = `${user.id}:${preferredSlug ?? ""}`;
  const nowMs = Date.now();
  const cachedTenantId = tenantIdByUserId.get(cacheKey);
  let tenantId =
    cachedTenantId && cachedTenantId.expiresAt > nowMs
      ? cachedTenantId.tenantId
      : null;

  if (!tenantId) {
    let inflight = tenantIdResolveInflightByUserId.get(cacheKey);
    if (!inflight) {
      inflight = resolveTenantIdForUser(user.id, user.email).finally(() => {
        tenantIdResolveInflightByUserId.delete(cacheKey);
      });
      tenantIdResolveInflightByUserId.set(cacheKey, inflight);
    }
    tenantId = await inflight;
    if (tenantId) {
      tenantIdByUserId.set(cacheKey, {
        expiresAt: nowMs + TENANT_ID_USER_CACHE_TTL_MS,
        tenantId,
      });
    }
  }

  if (!tenantId) {
    throw new ChatbotError(
      "bad_request:database",
      "No tenant found for this user"
    );
  }

  const warmUntil = tenantUserWarmByUserId.get(user.id) ?? 0;
  if (warmUntil <= nowMs) {
    let warmInflight = tenantUserWarmInflightByUserId.get(user.id);
    if (!warmInflight) {
      warmInflight = (async () => {
        const now = new Date();
        const tenantUserId = toTenantUserId(user.id);
        await baseDb
          .insert(chatUser)
          .values({
            createdAt: now,
            email: user.email ?? `${tenantUserId}@tenant.local`,
            emailVerified: true,
            id: tenantUserId,
            name: user.email ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            set: {
              email: user.email ?? `${tenantUserId}@tenant.local`,
              name: user.email ?? null,
              updatedAt: now,
            },
            target: chatUser.id,
          });
        tenantUserWarmByUserId.set(
          user.id,
          Date.now() + TENANT_USER_WARM_TTL_MS
        );
      })().finally(() => {
        tenantUserWarmInflightByUserId.delete(user.id);
      });
      tenantUserWarmInflightByUserId.set(user.id, warmInflight);
    }
    await warmInflight;
  }

  // Transaction-local GUC so Postgres RLS policies can enforce tenant isolation.
  // Use Drizzle's transaction API — wrapping a postgres.js `tx` with drizzle(tx)
  // fails because transaction objects lack client.options.parsers.
  return await baseDb.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`
    );
    return tenantDbContext.run({ db: tx, tenantId }, fn);
  });
}

/** Trusted worker/workflow tenant scope when no request cookie is available. */
export function withTenantId<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new ChatbotError(
      "bad_request:database",
      "Tenant context missing for workflow operation"
    );
  }
  return baseDb.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${tenantId}, true)`
    );
    return tenantDbContext.run({ db: tx, tenantId }, fn);
  });
}

export async function saveChat({
  id,
  userId,
  title,
  knowledgeBaseId,
}: {
  id: string;
  userId: string;
  title: string;
  knowledgeBaseId?: string | null;
}) {
  const ctx = tenantDbContext.getStore();
  if (!ctx?.tenantId) {
    throw new ChatbotError(
      "bad_request:database",
      "Tenant context missing for chat save"
    );
  }

  try {
    return await db.insert(chat).values({
      createdAt: new Date(),
      id,
      knowledgeBaseId: knowledgeBaseId ?? null,
      tenantId: ctx.tenantId,
      title,
      userId,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    const tenantId = requireActiveTenantId();

    // Verify the chat belongs to the active tenant before cascading deletes on
    // the tenant-less child tables (Message_v2, Vote_v2, Stream).
    const [ownedChat] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.tenantId, tenantId)))
      .limit(1);

    if (!ownedChat) {
      return;
    }

    const [chatsDeleted] = await db.transaction(async (tx) => {
      await tx.delete(vote).where(eq(vote.chatId, id));
      await tx.delete(messageReaction).where(eq(messageReaction.chatId, id));
      await tx.delete(message).where(eq(message.chatId, id));
      await tx.delete(stream).where(eq(stream.chatId, id));

      return await tx
        .delete(chat)
        .where(and(eq(chat.id, id), eq(chat.tenantId, tenantId)))
        .returning();
    });
    return chatsDeleted;
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
  excludeChatIds,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  excludeChatIds?: string[];
}) {
  try {
    const tenantId = requireActiveTenantId();
    const extendedLimit = limit + 1;
    const scope = eq(chat.tenantId, tenantId);
    const excluded =
      excludeChatIds && excludeChatIds.length > 0
        ? and(scope, notInArray(chat.id, excludeChatIds))
        : scope;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(chat.userId, id),
                eq(chat.kind, "personal"),
                excluded
              )
            : and(eq(chat.userId, id), eq(chat.kind, "personal"), excluded)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, startingAfter), scope))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(and(eq(chat.id, endingBefore), scope))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function searchChatsByUserId({
  id,
  limit,
  query,
}: {
  id: string;
  limit: number;
  query: string;
}) {
  const trimmed = query.trim().slice(0, 100);
  if (!trimmed) {
    return { chats: [], hasMore: false };
  }

  try {
    const tenantId = requireActiveTenantId();
    const escaped = trimmed.replace(/[%_\\]/g, "");
    const pattern = `%${escaped}%`;
    const rows = await db
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.tenantId, tenantId),
          eq(chat.userId, id),
          eq(chat.kind, "personal"),
          ilike(chat.title, pattern)
        )
      )
      .orderBy(desc(chat.createdAt))
      .limit(limit);

    return { chats: rows, hasMore: false };
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to search chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const tenantId = requireActiveTenantId();
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, id), eq(chat.tenantId, tenantId)));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    console.error("[getChatById]", _error);
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
  metadata,
}: {
  id: string;
  parts: DBMessage["parts"];
  metadata?: DBMessage["metadata"];
}) {
  try {
    return await db
      .update(message)
      .set({
        parts,
        ...(metadata === undefined ? {} : { metadata }),
      })
      .where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function updateMessageMetadata({
  id,
  metadata,
}: {
  id: string;
  metadata: DBMessage["metadata"];
}) {
  try {
    return await db.update(message).set({ metadata }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update message metadata"
    );
  }
}

export async function getMessagesByChatId({
  id,
  threadRootMessageId,
}: {
  id: string;
  /** Omit for main timeline. Set to a root message id for thread replies. */
  threadRootMessageId?: string;
}) {
  try {
    const tenantId = requireActiveTenantId();
    const threadFilter = threadRootMessageId
      ? sql`(${message.id} = ${threadRootMessageId} OR ${message.threadRootMessageId} = ${threadRootMessageId})`
      : isNull(message.threadRootMessageId);

    const rows = await db
      .select({ message })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(eq(message.chatId, id), eq(chat.tenantId, tenantId), threadFilter)
      )
      .orderBy(
        asc(message.createdAt),
        sql`case
          when ${message.role} = 'user' then 0
          when ${message.role} = 'assistant' then 1
          else 2
        end`
      );
    return rows.map((row) => row.message);
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getThreadReplyMessagesByChatId(chatId: string) {
  try {
    const tenantId = requireActiveTenantId();
    const rows = await db
      .select({ message })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(message.chatId, chatId),
          eq(chat.tenantId, tenantId),
          isNotNull(message.threadRootMessageId)
        )
      )
      .orderBy(
        asc(message.createdAt),
        sql`case
          when ${message.role} = 'user' then 0
          when ${message.role} = 'assistant' then 1
          else 2
        end`
      );
    return rows.map((row) => row.message);
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get thread reply messages"
    );
  }
}

export async function getThreadReplyCountsByChatId(chatId: string) {
  try {
    const tenantId = requireActiveTenantId();
    const rows = await db
      .select({
        replyCount: count(),
        threadRootMessageId: message.threadRootMessageId,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(message.chatId, chatId),
          eq(chat.tenantId, tenantId),
          isNotNull(message.threadRootMessageId)
        )
      )
      .groupBy(message.threadRootMessageId);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.threadRootMessageId) {
        counts[row.threadRootMessageId] = Number(row.replyCount);
      }
    }
    return counts;
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get thread reply counts"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      isUpvoted: type === "up",
      messageId,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function getMessageReactionsByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(messageReaction)
      .where(eq(messageReaction.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message reactions by chat id"
    );
  }
}

export async function toggleMessageReaction({
  chatId,
  emoji,
  messageId,
  userId,
}: {
  chatId: string;
  emoji: string;
  messageId: string;
  userId: string;
}): Promise<"added" | "removed"> {
  try {
    const [existing] = await db
      .select()
      .from(messageReaction)
      .where(
        and(
          eq(messageReaction.messageId, messageId),
          eq(messageReaction.userId, userId),
          eq(messageReaction.emoji, emoji)
        )
      );

    if (existing) {
      await db
        .delete(messageReaction)
        .where(
          and(
            eq(messageReaction.messageId, messageId),
            eq(messageReaction.userId, userId),
            eq(messageReaction.emoji, emoji)
          )
        );
      return "removed";
    }

    await db.insert(messageReaction).values({
      chatId,
      emoji,
      messageId,
      userId,
    });
    return "added";
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to toggle message reaction"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  driveFileId,
  driveWebViewLink,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  driveFileId?: string | null;
  driveWebViewLink?: string | null;
}) {
  try {
    let resolvedDriveFileId = driveFileId;
    let resolvedDriveWebViewLink = driveWebViewLink;

    if (resolvedDriveFileId === undefined) {
      const [previous] = await db
        .select({
          driveFileId: document.driveFileId,
          driveWebViewLink: document.driveWebViewLink,
        })
        .from(document)
        .where(and(eq(document.id, id), eq(document.userId, userId)))
        .orderBy(desc(document.createdAt))
        .limit(1);
      resolvedDriveFileId = previous?.driveFileId ?? null;
      resolvedDriveWebViewLink = previous?.driveWebViewLink ?? null;
    }

    return await db
      .insert(document)
      .values({
        content,
        createdAt: new Date(),
        driveFileId: resolvedDriveFileId,
        driveWebViewLink: resolvedDriveWebViewLink,
        id,
        kind,
        title,
        userId,
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
  userId,
}: {
  id: string;
  content: string;
  userId: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(
        and(
          eq(document.id, id),
          eq(document.userId, userId),
          eq(document.createdAt, latest.createdAt)
        )
      )
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content"
    );
  }
}

export async function getDocumentsById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(and(eq(document.id, id), eq(document.userId, userId)))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
  userId,
}: {
  id: string;
  timestamp: Date;
  userId: string;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          eq(suggestion.userId, userId),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(
        and(
          eq(document.id, id),
          eq(document.userId, userId),
          gt(document.createdAt, timestamp)
        )
      )
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
  userId,
}: {
  documentId: string;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(
        and(
          eq(suggestion.documentId, documentId),
          eq(suggestion.userId, userId)
        )
      );
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
  excludeMessageId,
}: {
  chatId: string;
  timestamp: Date;
  excludeMessageId?: string;
}) {
  try {
    const conditions = [
      eq(message.chatId, chatId),
      gte(message.createdAt, timestamp),
    ];

    if (excludeMessageId) {
      conditions.push(ne(message.id, excludeMessageId));
    }

    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(and(...conditions));

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      return await db.transaction(async (tx) => {
        await tx
          .delete(vote)
          .where(
            and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
          );
        await tx
          .delete(messageReaction)
          .where(
            and(
              eq(messageReaction.chatId, chatId),
              inArray(messageReaction.messageId, messageIds)
            )
          );

        return await tx
          .delete(message)
          .where(
            and(eq(message.chatId, chatId), inArray(message.id, messageIds))
          );
      });
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    const tenantId = requireActiveTenantId();
    return await db
      .update(chat)
      .set({ title })
      .where(and(eq(chat.id, chatId), eq(chat.tenantId, tenantId)));
  } catch (_error) {}
}

export async function updateChatThreadTagCatalog({
  chatId,
  threadTagCatalog,
}: {
  chatId: string;
  threadTagCatalog: unknown[] | null;
}) {
  try {
    const tenantId = requireActiveTenantId();
    const [updated] = await db
      .update(chat)
      .set({
        threadTagCatalog:
          threadTagCatalog && threadTagCatalog.length > 0
            ? threadTagCatalog
            : null,
      })
      .where(and(eq(chat.id, chatId), eq(chat.tenantId, tenantId)))
      .returning({ threadTagCatalog: chat.threadTagCatalog });

    if (!updated) {
      throw new ChatbotError(
        "not_found:chat",
        "Channel not found or could not update thread tags"
      );
    }

    return updated.threadTagCatalog;
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update channel thread tags"
    );
  }
}

export async function updateChatContextSummary(args: {
  chatId: string;
  summary: string;
  throughMessageId: string;
}) {
  try {
    const tenantId = requireActiveTenantId();
    return await db
      .update(chat)
      .set({
        contextSummary: args.summary,
        contextSummaryThroughMessageId: args.throughMessageId,
        contextSummaryUpdatedAt: new Date(),
      })
      .where(and(eq(chat.id, args.chatId), eq(chat.tenantId, tenantId)));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat context summary"
    );
  }
}

export async function createChatWorkflowRun(args: {
  workflowRunId: string;
  chatId: string;
  assistantMessageId: string;
  userMessageId: string;
  authUserId: string;
  modelId?: string;
  usageEventId?: string;
  idempotencyKey: string;
}) {
  const tenantId = requireActiveTenantId();
  const [created] = await db
    .insert(chatWorkflowRuns)
    .values({
      ...args,
      status: "running",
      tenantId,
    })
    .onConflictDoNothing({ target: chatWorkflowRuns.idempotencyKey })
    .returning();

  if (created) {
    return created;
  }

  const [existing] = await db
    .select()
    .from(chatWorkflowRuns)
    .where(
      and(
        eq(chatWorkflowRuns.tenantId, tenantId),
        eq(chatWorkflowRuns.idempotencyKey, args.idempotencyKey)
      )
    )
    .limit(1);
  return existing;
}

export async function updateAssistantWorkflowRunMetadata(args: {
  assistantMessageId: string;
  workflowRunId: string;
  modelId?: string;
  workflowRunStatus?:
    | "pending"
    | "running"
    | "suspended"
    | "success"
    | "failed"
    | "cancelled";
}) {
  const [existingMessage] = await getMessageById({
    id: args.assistantMessageId,
  });
  if (!existingMessage) {
    return;
  }
  const existingMetadata =
    existingMessage.metadata && typeof existingMessage.metadata === "object"
      ? existingMessage.metadata
      : {};
  await updateMessage({
    id: args.assistantMessageId,
    metadata: {
      ...existingMetadata,
      workflowRunId: args.workflowRunId,
      workflowRunStatus: args.workflowRunStatus ?? "running",
      ...(args.modelId ? { modelId: args.modelId } : {}),
    },
    parts: existingMessage.parts,
  });
}

export async function createChatWorkflowRunAndUpdateMessage(args: {
  workflowRun: Parameters<typeof createChatWorkflowRun>[0];
  message: {
    id: string;
    parts: DBMessage["parts"];
    metadata: DBMessage["metadata"];
  };
}) {
  const mapping = await createChatWorkflowRun(args.workflowRun);
  if (mapping?.workflowRunId !== args.workflowRun.workflowRunId) {
    return mapping;
  }

  const [existingMessage] = await getMessageById({ id: args.message.id });
  const existingMetadata =
    existingMessage?.metadata && typeof existingMessage.metadata === "object"
      ? existingMessage.metadata
      : {};
  const requestedMetadata =
    args.message.metadata && typeof args.message.metadata === "object"
      ? args.message.metadata
      : {};
  const workflowRunStatus = [
    "suspended",
    "success",
    "failed",
    "cancelled",
  ].includes(mapping.status)
    ? mapping.status
    : "running";
  await updateMessage({
    id: args.message.id,
    metadata: {
      ...existingMetadata,
      ...requestedMetadata,
      pendingToolApproval:
        workflowRunStatus === "suspended"
          ? (existingMetadata as { pendingToolApproval?: unknown })
              .pendingToolApproval
          : undefined,
      workflowRunStatus,
    },
    parts: existingMessage?.parts ?? args.message.parts,
  });
  return mapping;
}

export async function getChatWorkflowRun(workflowRunId: string) {
  const tenantId = requireActiveTenantId();
  const [run] = await db
    .select()
    .from(chatWorkflowRuns)
    .where(
      and(
        eq(chatWorkflowRuns.workflowRunId, workflowRunId),
        eq(chatWorkflowRuns.tenantId, tenantId)
      )
    )
    .limit(1);
  return run;
}

export async function getChatWorkflowRunByIdempotencyKey(
  idempotencyKey: string
) {
  const tenantId = requireActiveTenantId();
  const [run] = await db
    .select()
    .from(chatWorkflowRuns)
    .where(
      and(
        eq(chatWorkflowRuns.idempotencyKey, idempotencyKey),
        eq(chatWorkflowRuns.tenantId, tenantId)
      )
    )
    .limit(1);
  return run;
}

export async function getLatestChatWorkflowRunForAssistantMessage(
  assistantMessageId: string
) {
  const tenantId = requireActiveTenantId();
  const [run] = await db
    .select()
    .from(chatWorkflowRuns)
    .where(
      and(
        eq(chatWorkflowRuns.assistantMessageId, assistantMessageId),
        eq(chatWorkflowRuns.tenantId, tenantId)
      )
    )
    .orderBy(desc(chatWorkflowRuns.createdAt))
    .limit(1);
  return run;
}

export async function getWorkflowUsageEventIdForAssistantMessage(
  assistantMessageId: string
) {
  const tenantId = requireActiveTenantId();
  const [run] = await db
    .select({ usageEventId: chatWorkflowRuns.usageEventId })
    .from(chatWorkflowRuns)
    .where(
      and(
        eq(chatWorkflowRuns.assistantMessageId, assistantMessageId),
        eq(chatWorkflowRuns.tenantId, tenantId),
        isNotNull(chatWorkflowRuns.usageEventId)
      )
    )
    .orderBy(desc(chatWorkflowRuns.createdAt))
    .limit(1);
  return run?.usageEventId ?? null;
}

export async function updateChatWorkflowRunStatus(args: {
  workflowRunId: string;
  status:
    | "pending"
    | "running"
    | "suspended"
    | "success"
    | "failed"
    | "cancelled";
  usageEventId?: string;
}) {
  const tenantId = requireActiveTenantId();
  const [run] = await db
    .update(chatWorkflowRuns)
    .set({
      status: args.status,
      updatedAt: new Date(),
      ...(args.usageEventId ? { usageEventId: args.usageEventId } : {}),
    })
    .where(
      and(
        eq(chatWorkflowRuns.workflowRunId, args.workflowRunId),
        eq(chatWorkflowRuns.tenantId, tenantId)
      )
    )
    .returning();
  return run;
}

export async function resetToolExecutionLedgerEntry(args: {
  workflowRunId: string;
  toolCallId: string;
}) {
  const tenantId = requireActiveTenantId();
  await db
    .delete(toolExecutionLedger)
    .where(
      and(
        eq(toolExecutionLedger.tenantId, tenantId),
        eq(toolExecutionLedger.workflowRunId, args.workflowRunId),
        eq(toolExecutionLedger.toolCallId, args.toolCallId)
      )
    );
}

export async function beginToolExecution(args: {
  workflowRunId: string;
  toolCallId: string;
  toolName: string;
  inputHash?: string;
}) {
  const tenantId = requireActiveTenantId();
  const [created] = await db
    .insert(toolExecutionLedger)
    .values({ ...args, status: "running", tenantId })
    .onConflictDoNothing({
      target: [
        toolExecutionLedger.workflowRunId,
        toolExecutionLedger.toolCallId,
      ],
    })
    .returning();

  if (created) {
    return { acquired: true as const, entry: created };
  }

  const [existing] = await db
    .select()
    .from(toolExecutionLedger)
    .where(
      and(
        eq(toolExecutionLedger.tenantId, tenantId),
        eq(toolExecutionLedger.workflowRunId, args.workflowRunId),
        eq(toolExecutionLedger.toolCallId, args.toolCallId)
      )
    )
    .limit(1);
  return { acquired: false as const, entry: existing };
}

export async function getCompletedToolExecutionsForWorkflowRun(args: {
  workflowRunId: string;
}) {
  const tenantId = requireActiveTenantId();
  return await db
    .select({
      error: toolExecutionLedger.error,
      result: toolExecutionLedger.result,
      toolCallId: toolExecutionLedger.toolCallId,
      toolName: toolExecutionLedger.toolName,
    })
    .from(toolExecutionLedger)
    .where(
      and(
        eq(toolExecutionLedger.tenantId, tenantId),
        eq(toolExecutionLedger.workflowRunId, args.workflowRunId),
        eq(toolExecutionLedger.status, "completed")
      )
    );
}

export async function completeToolExecution(args: {
  workflowRunId: string;
  toolCallId: string;
  result?: unknown;
  error?: string;
}) {
  const tenantId = requireActiveTenantId();
  const [entry] = await db
    .update(toolExecutionLedger)
    .set({
      error: args.error,
      result: args.result,
      status: args.error ? "failed" : "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(toolExecutionLedger.tenantId, tenantId),
        eq(toolExecutionLedger.workflowRunId, args.workflowRunId),
        eq(toolExecutionLedger.toolCallId, args.toolCallId)
      )
    )
    .returning();
  return entry;
}

export async function updateChatKnowledgeBaseById({
  chatId,
  knowledgeBaseId,
}: {
  chatId: string;
  knowledgeBaseId: string | null;
}) {
  try {
    const tenantId = requireActiveTenantId();
    return await db
      .update(chat)
      .set({ knowledgeBaseId })
      .where(and(eq(chat.id, chatId), eq(chat.tenantId, tenantId)));
  } catch (_error) {}
}

export async function getMessageCountByUserId({
  id,
  differenceInMinutes,
}: {
  id: string;
  differenceInMinutes: number;
}) {
  try {
    const tenantId = requireActiveTenantId();
    const cutoffTime = new Date(Date.now() - differenceInMinutes * 60 * 1000);

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          eq(chat.tenantId, tenantId),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ chatId, createdAt: new Date(), id: streamId });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function createTenant({
  companyName,
  slug,
  primaryDomain,
}: {
  companyName: string;
  slug: string;
  primaryDomain: string;
}) {
  try {
    const [tenant] = await baseDb
      .insert(tenants)
      .values({
        companyName,
        primaryDomain,
        slug,
      })
      .returning();

    await baseDb.insert(tenantDomains).values({
      domain: primaryDomain,
      tenantId: tenant.id,
      verifiedAt: new Date(),
    });

    return tenant;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create tenant");
  }
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const [tenant] = await baseDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return tenant ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to get tenant"
    );
  }
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  try {
    const [tenant] = await baseDb
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return tenant ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to get tenant by id"
    );
  }
}

export async function getTenantByDomain(
  domain: string
): Promise<Tenant | null> {
  try {
    const [tenant] = await baseDb
      .select({ tenant: tenants })
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
      .where(
        and(eq(tenantDomains.domain, domain), eq(tenants.status, "active"))
      )
      .limit(1);

    return tenant?.tenant ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to get tenant by domain"
    );
  }
}

export async function getTenantActiveSsoProvider(tenantId: string) {
  try {
    const [row] = await baseDb
      .select({ provider: tenantSsoConfigs.provider })
      .from(tenantSsoConfigs)
      .where(
        and(
          eq(tenantSsoConfigs.tenantId, tenantId),
          eq(tenantSsoConfigs.status, "active")
        )
      )
      .limit(1);

    return row?.provider ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to get tenant SSO provider"
    );
  }
}

export async function createTenantSetupToken({
  tenantId,
  expiresInDays,
}: {
  tenantId: string;
  expiresInDays: number;
}) {
  const plainToken =
    generateUUID().replaceAll("-", "") + generateUUID().replaceAll("-", "");
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  try {
    await baseDb.insert(tenantSetupTokens).values({
      expiresAt,
      tenantId,
      tokenHash,
    });

    return { expiresAt, token: plainToken };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create tenant setup token"
    );
  }
}

export async function getSetupTokenTenant({
  token,
}: {
  token: string;
}): Promise<Tenant | null> {
  try {
    const now = new Date();
    const hashed = hashToken(token);
    const [result] = await baseDb
      .select({ tenant: tenants })
      .from(tenantSetupTokens)
      .innerJoin(tenants, eq(tenantSetupTokens.tenantId, tenants.id))
      .where(
        and(
          eq(tenantSetupTokens.tokenHash, hashed),
          gt(tenantSetupTokens.expiresAt, now)
        )
      )
      .limit(1);

    return result?.tenant ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to validate setup token"
    );
  }
}

export async function completeTenantSetup({
  token,
  provider,
  issuerUrl,
  clientId,
  clientSecret,
  adminEmails,
  directoryConfig,
}: {
  token: string;
  provider: "google_workspace" | "okta" | "azure_ad";
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  adminEmails: string[];
  directoryConfig?: {
    baseUrl?: string;
    oktaOAuthClientId?: string;
    oktaPrivateKey?: string;
    tenantId?: string;
    clientId?: string;
    azureClientCertificatePem?: string;
    domain?: string;
    allowedOrgUnits?: string[];
  };
}) {
  const now = new Date();
  const hashed = hashToken(token);

  try {
    const [setupRecord] = await baseDb
      .select()
      .from(tenantSetupTokens)
      .where(
        and(
          eq(tenantSetupTokens.tokenHash, hashed),
          gt(tenantSetupTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!setupRecord || setupRecord.usedAt) {
      throw new ChatbotError(
        "bad_request:api",
        "Invalid or expired setup token"
      );
    }

    const [tenant] = await baseDb
      .select({
        id: tenants.id,
        primaryDomain: tenants.primaryDomain,
        slug: tenants.slug,
      })
      .from(tenants)
      .where(eq(tenants.id, setupRecord.tenantId))
      .limit(1);

    if (!tenant) {
      throw new ChatbotError(
        "bad_request:database",
        "Tenant not found for setup"
      );
    }

    await baseDb
      .delete(tenantAdminContacts)
      .where(eq(tenantAdminContacts.tenantId, setupRecord.tenantId));

    await baseDb.insert(tenantAdminContacts).values(
      adminEmails.map((email) => ({
        email,
        tenantId: setupRecord.tenantId,
      }))
    );

    await baseDb
      .delete(tenantSsoConfigs)
      .where(eq(tenantSsoConfigs.tenantId, setupRecord.tenantId));

    const directoryForMetadata =
      directoryConfig == null
        ? null
        : encryptDirectoryCredentialsForStorage(
            Object.fromEntries(
              Object.entries(directoryConfig).filter(([key]) => {
                if (
                  provider === "okta" &&
                  (key === "apiToken" || key === "oktaPrivateKeyKid")
                ) {
                  return false;
                }
                return key !== "clientSecret";
              })
            ) as Record<string, unknown>
          );

    await baseDb.insert(tenantSsoConfigs).values({
      clientId,
      clientSecretEncrypted: encryptSecret(clientSecret),
      issuerUrl,
      metadata: {
        configuredAt: now.toISOString(),
        directory: directoryForMetadata,
        peopleSync: {
          mode: "idp_pull",
          provider,
        },
      },
      provider,
      status: "active",
      tenantId: setupRecord.tenantId,
    });

    const providerId = providerRouteIdById[provider];
    const issuerWithoutTrailingSlash = issuerUrl.replace(/\/+$/, "");
    const oidcConfig = sealOidcConfigJson({
      clientId,
      clientSecret,
      discoveryEndpoint: `${issuerWithoutTrailingSlash}/.well-known/openid-configuration`,
      issuer: issuerUrl,
      pkce: true,
    });

    await baseDb
      .delete(authSsoProvider)
      .where(eq(authSsoProvider.domain, tenant.primaryDomain));

    await baseDb
      .delete(authSsoProvider)
      .where(eq(authSsoProvider.providerId, providerId));

    await baseDb.insert(authSsoProvider).values({
      createdAt: now,
      domain: tenant.primaryDomain,
      domainVerified: true,
      id: generateUUID(),
      issuer: issuerUrl,
      oidcConfig,
      providerId,
      updatedAt: now,
    });

    await baseDb
      .update(tenants)
      .set({
        status: "active",
        updatedAt: now,
      })
      .where(eq(tenants.id, setupRecord.tenantId));

    await baseDb
      .update(tenantSetupTokens)
      .set({ usedAt: now })
      .where(eq(tenantSetupTokens.id, setupRecord.id));

    invalidateTenantAccessContextCacheForTenant(setupRecord.tenantId);

    return { tenantId: setupRecord.tenantId };
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }

    throw new ChatbotError("bad_request:database", "Failed to complete setup");
  }
}

export async function ensureAuthSsoProviderForDomain(domain: string) {
  try {
    const [record] = await baseDb
      .select({
        clientId: tenantSsoConfigs.clientId,
        clientSecretEncrypted: tenantSsoConfigs.clientSecretEncrypted,
        issuerUrl: tenantSsoConfigs.issuerUrl,
        provider: tenantSsoConfigs.provider,
        tenantDomain: tenantDomains.domain,
        tenantId: tenants.id,
      })
      .from(tenantDomains)
      .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
      .innerJoin(tenantSsoConfigs, eq(tenantSsoConfigs.tenantId, tenants.id))
      .where(
        and(
          eq(tenantDomains.domain, domain),
          eq(tenants.status, "active"),
          eq(tenantSsoConfigs.status, "active")
        )
      )
      .limit(1);

    if (!record) {
      return false;
    }

    const now = new Date();
    const providerId = providerRouteIdById[record.provider];
    const issuerWithoutTrailingSlash = record.issuerUrl.replace(/\/+$/, "");
    const oidcConfig = sealOidcConfigJson({
      clientId: record.clientId,
      clientSecret: decryptSecret(record.clientSecretEncrypted),
      discoveryEndpoint: `${issuerWithoutTrailingSlash}/.well-known/openid-configuration`,
      issuer: record.issuerUrl,
      pkce: true,
    });

    await baseDb
      .delete(authSsoProvider)
      .where(eq(authSsoProvider.domain, record.tenantDomain));

    await baseDb
      .delete(authSsoProvider)
      .where(eq(authSsoProvider.providerId, providerId));

    await baseDb.insert(authSsoProvider).values({
      createdAt: now,
      domain: record.tenantDomain,
      domainVerified: true,
      id: generateUUID(),
      issuer: record.issuerUrl,
      oidcConfig,
      providerId,
      updatedAt: now,
    });

    return true;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ensure auth SSO provider"
    );
  }
}

export type TenantPersonInput = {
  tenantId: string;
  externalId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  department?: string | null;
  title?: string | null;
  managerEmail?: string | null;
  location?: string | null;
  source?: (typeof peopleSyncSourceEnum.enumValues)[number];
  status?: (typeof peopleSyncStatusEnum.enumValues)[number];
  userData?: Record<string, unknown> | null;
  provider?: "google_workspace" | "okta" | "azure_ad";
  issuer?: string | null;
  subject?: string | null;
};

export async function upsertTenantPerson(input: TenantPersonInput) {
  const now = new Date();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedManagerEmail =
    input.managerEmail?.trim().toLowerCase() ?? null;
  const source = input.source ?? "idp_pull";
  const status = input.status ?? "active";

  try {
    const [existing] = await baseDb
      .select()
      .from(tenantPeople)
      .where(
        and(
          eq(tenantPeople.tenantId, input.tenantId),
          eq(tenantPeople.email, normalizedEmail)
        )
      )
      .limit(1);

    let personRow: typeof existing | undefined;

    if (existing) {
      const [updated] = await baseDb
        .update(tenantPeople)
        .set({
          department: input.department ?? existing.department,
          displayName: input.displayName ?? existing.displayName,
          externalId: input.externalId ?? existing.externalId,
          firstName: input.firstName ?? existing.firstName,
          lastName: input.lastName ?? existing.lastName,
          lastSyncedAt: now,
          location: input.location ?? existing.location,
          managerEmail: normalizedManagerEmail ?? existing.managerEmail,
          source,
          status,
          title: input.title ?? existing.title,
          updatedAt: now,
        })
        .where(eq(tenantPeople.id, existing.id))
        .returning();
      personRow = updated;
    } else {
      const [created] = await baseDb
        .insert(tenantPeople)
        .values({
          createdAt: now,
          department: input.department ?? null,
          displayName: input.displayName ?? null,
          email: normalizedEmail,
          externalId: input.externalId ?? null,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          lastSyncedAt: now,
          location: input.location ?? null,
          managerEmail: normalizedManagerEmail,
          source,
          status,
          tenantId: input.tenantId,
          title: input.title ?? null,
          updatedAt: now,
        })
        .returning();
      personRow = created;
    }

    // IdP inactive → deactivate matching members; active does not auto-reactivate.
    if (status === "inactive") {
      const deactivated = await baseDb
        .update(tenantMembers)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(tenantMembers.tenantId, input.tenantId),
            eq(tenantMembers.email, normalizedEmail)
          )
        )
        .returning({ authUserId: tenantMembers.authUserId });

      const { invalidateAuthSessionsForUser } = await import(
        "@/core/lib/auth/invalidate-sessions"
      );
      await Promise.all(
        deactivated
          .map((row) => row.authUserId)
          .filter((id): id is string => Boolean(id))
          .map((authUserId) => invalidateAuthSessionsForUser(authUserId))
      );
    }

    invalidateTenantAccessContextCacheForEmail(normalizedEmail);
    return personRow;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to upsert tenant person"
    );
  }
}

/** Link members with null personId to TenantPerson rows matching on email. */
export async function linkTenantMembersPersonIdByEmail(tenantId: string) {
  const now = new Date();
  try {
    const unmatched = await baseDb
      .select({
        memberId: tenantMembers.id,
        personId: tenantPeople.id,
      })
      .from(tenantMembers)
      .innerJoin(
        tenantPeople,
        and(
          eq(tenantPeople.tenantId, tenantMembers.tenantId),
          eq(tenantPeople.email, tenantMembers.email)
        )
      )
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          isNull(tenantMembers.personId)
        )
      );

    await Promise.all(
      unmatched.map((row) =>
        baseDb
          .update(tenantMembers)
          .set({ personId: row.personId, updatedAt: now })
          .where(eq(tenantMembers.id, row.memberId))
      )
    );

    return unmatched.length;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to link tenant members to people"
    );
  }
}

export async function upsertTenantIdentityForPerson(input: TenantPersonInput) {
  if (!input.provider || !input.subject || !input.issuer) {
    return null;
  }

  try {
    const [existing] = await baseDb
      .select()
      .from(tenantIdentities)
      .where(
        and(
          eq(tenantIdentities.tenantId, input.tenantId),
          eq(tenantIdentities.issuer, input.issuer),
          eq(tenantIdentities.subject, input.subject)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await baseDb
        .update(tenantIdentities)
        .set({
          email: input.email.trim().toLowerCase(),
          externalId: input.externalId ?? existing.externalId,
          lastSyncedAt: new Date(),
          source: input.source ?? existing.source,
          syncStatus: input.status ?? existing.syncStatus,
          userData: input.userData ?? existing.userData,
        })
        .where(eq(tenantIdentities.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await baseDb
      .insert(tenantIdentities)
      .values({
        email: input.email.trim().toLowerCase(),
        externalId: input.externalId ?? null,
        issuer: input.issuer,
        lastSyncedAt: new Date(),
        provider: input.provider,
        source: input.source ?? "idp_pull",
        subject: input.subject,
        syncStatus: input.status ?? "active",
        tenantId: input.tenantId,
        userData: input.userData ?? null,
      })
      .returning();
    return created;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to upsert tenant identity"
    );
  }
}

export async function getTenantPeopleBySlug(slug: string) {
  try {
    const rows = await baseDb
      .select({
        department: tenantPeople.department,
        displayName: tenantPeople.displayName,
        email: tenantPeople.email,
        firstName: tenantPeople.firstName,
        id: tenantPeople.id,
        lastName: tenantPeople.lastName,
        lastSyncedAt: tenantPeople.lastSyncedAt,
        location: tenantPeople.location,
        managerEmail: tenantPeople.managerEmail,
        status: tenantPeople.status,
        title: tenantPeople.title,
      })
      .from(tenantPeople)
      .innerJoin(tenants, eq(tenantPeople.tenantId, tenants.id))
      .where(eq(tenants.slug, slug))
      .orderBy(asc(tenantPeople.email));
    return rows;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list tenant people"
    );
  }
}

export async function getTenantPeopleStatus(tenantId: string) {
  try {
    const [latestRun] = await baseDb
      .select()
      .from(tenantPeopleSyncRuns)
      .where(eq(tenantPeopleSyncRuns.tenantId, tenantId))
      .orderBy(desc(tenantPeopleSyncRuns.startedAt))
      .limit(1);

    const [peopleCountRow] = await baseDb
      .select({ total: count() })
      .from(tenantPeople)
      .where(eq(tenantPeople.tenantId, tenantId));

    const [openIssueCountRow] = await baseDb
      .select({ total: count() })
      .from(tenantPeopleSyncIssues)
      .where(
        and(
          eq(tenantPeopleSyncIssues.tenantId, tenantId),
          isNull(tenantPeopleSyncIssues.resolvedAt)
        )
      );

    return {
      latestRun: latestRun ?? null,
      openIssues: openIssueCountRow?.total ?? 0,
      peopleCount: peopleCountRow?.total ?? 0,
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to fetch tenant people sync status"
    );
  }
}

export async function createPeopleSyncRun({
  tenantId,
  provider,
  source,
}: {
  tenantId: string;
  provider: "google_workspace" | "okta" | "azure_ad";
  source: (typeof peopleSyncSourceEnum.enumValues)[number];
}) {
  try {
    const [run] = await baseDb
      .insert(tenantPeopleSyncRuns)
      .values({
        provider,
        source,
        startedAt: new Date(),
        status: "running",
        tenantId,
      })
      .returning();
    return run;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to create sync run"
    );
  }
}

export async function completePeopleSyncRun({
  runId,
  status,
  usersProcessed,
  usersUpserted,
  usersDeactivated,
  errorsCount,
  metadata,
}: {
  runId: string;
  status: (typeof peopleSyncRunStatusEnum.enumValues)[number];
  usersProcessed: number;
  usersUpserted: number;
  usersDeactivated: number;
  errorsCount: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    await baseDb
      .update(tenantPeopleSyncRuns)
      .set({
        completedAt: new Date(),
        errorsCount,
        metadata: metadata ?? null,
        status,
        usersDeactivated,
        usersProcessed,
        usersUpserted,
      })
      .where(eq(tenantPeopleSyncRuns.id, runId));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to complete sync run"
    );
  }
}

export async function createPeopleSyncIssue({
  tenantId,
  personEmail,
  externalId,
  issueCode,
  issueMessage,
}: {
  tenantId: string;
  personEmail?: string | null;
  externalId?: string | null;
  issueCode: string;
  issueMessage: string;
}) {
  try {
    await baseDb.insert(tenantPeopleSyncIssues).values({
      createdAt: new Date(),
      externalId: externalId ?? null,
      issueCode,
      issueMessage,
      personEmail: personEmail ?? null,
      tenantId,
    });
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to create sync issue"
    );
  }
}

export async function listOpenPeopleSyncIssues(tenantId: string) {
  try {
    return await baseDb
      .select()
      .from(tenantPeopleSyncIssues)
      .where(
        and(
          eq(tenantPeopleSyncIssues.tenantId, tenantId),
          isNull(tenantPeopleSyncIssues.resolvedAt)
        )
      )
      .orderBy(desc(tenantPeopleSyncIssues.createdAt));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list sync issues"
    );
  }
}

export async function resolvePeopleSyncIssue(issueId: string) {
  try {
    await baseDb
      .update(tenantPeopleSyncIssues)
      .set({ resolvedAt: new Date() })
      .where(eq(tenantPeopleSyncIssues.id, issueId));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to resolve sync issue"
    );
  }
}

export async function deactivateTenantPersonById({
  tenantId,
  personId,
}: {
  tenantId: string;
  personId: string;
}) {
  try {
    const [personRow] = await baseDb
      .select({ email: tenantPeople.email })
      .from(tenantPeople)
      .where(
        and(eq(tenantPeople.tenantId, tenantId), eq(tenantPeople.id, personId))
      )
      .limit(1);

    await baseDb
      .update(tenantPeople)
      .set({
        lastSyncedAt: new Date(),
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(
        and(eq(tenantPeople.tenantId, tenantId), eq(tenantPeople.id, personId))
      );

    if (personRow) {
      invalidateTenantAccessContextCacheForEmail(personRow.email);
    }
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to deactivate person"
    );
  }
}

export async function getTenantPeopleProviderConfigBySlug(slug: string) {
  try {
    const [row] = await baseDb
      .select({
        metadata: tenantSsoConfigs.metadata,
        provider: tenantSsoConfigs.provider,
        slug: tenants.slug,
        status: tenantSsoConfigs.status,
        tenantId: tenants.id,
      })
      .from(tenants)
      .innerJoin(tenantSsoConfigs, eq(tenantSsoConfigs.tenantId, tenants.id))
      .where(eq(tenants.slug, slug))
      .limit(1);
    return row ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to get tenant provider config"
    );
  }
}

export async function updateTenantAllowedOrgUnits({
  tenantId,
  allowedOrgUnits,
}: {
  tenantId: string;
  allowedOrgUnits: string[];
}) {
  try {
    const [config] = await baseDb
      .select({
        id: tenantSsoConfigs.id,
        metadata: tenantSsoConfigs.metadata,
      })
      .from(tenantSsoConfigs)
      .where(eq(tenantSsoConfigs.tenantId, tenantId))
      .limit(1);

    if (!config) {
      throw new ChatbotError(
        "bad_request:database",
        "Tenant SSO config not found"
      );
    }

    const existingMetadata =
      config.metadata &&
      typeof config.metadata === "object" &&
      !Array.isArray(config.metadata)
        ? (config.metadata as Record<string, unknown>)
        : {};
    const existingDirectory =
      existingMetadata.directory &&
      typeof existingMetadata.directory === "object" &&
      !Array.isArray(existingMetadata.directory)
        ? (existingMetadata.directory as Record<string, unknown>)
        : {};

    const nextMetadata = {
      ...existingMetadata,
      directory: {
        ...existingDirectory,
        allowedOrgUnits,
      },
    };

    await baseDb
      .update(tenantSsoConfigs)
      .set({
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(tenantSsoConfigs.id, config.id));

    invalidateTenantAccessContextCacheForTenant(tenantId);
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update allowed org units"
    );
  }
}

export async function updateTenantPeopleSettings({
  tenantId,
  peopleProvider,
  directoryConfig,
}: {
  tenantId: string;
  peopleProvider: "google_workspace" | "okta" | "azure_ad";
  directoryConfig: {
    baseUrl?: string;
    oktaOAuthClientId?: string;
    oktaPrivateKey?: string;
    tenantId?: string;
    clientId?: string;
    azureClientCertificatePem?: string;
    domain?: string;
    delegatedAdminEmail?: string;
    serviceAccountClientEmail?: string;
    serviceAccountPrivateKey?: string;
    allowedOrgUnits?: string[];
  };
}) {
  try {
    const [config] = await baseDb
      .select({
        id: tenantSsoConfigs.id,
        metadata: tenantSsoConfigs.metadata,
      })
      .from(tenantSsoConfigs)
      .where(eq(tenantSsoConfigs.tenantId, tenantId))
      .limit(1);

    if (!config) {
      throw new ChatbotError(
        "bad_request:database",
        "Tenant SSO config not found"
      );
    }

    const existingMetadata =
      config.metadata &&
      typeof config.metadata === "object" &&
      !Array.isArray(config.metadata)
        ? (config.metadata as Record<string, unknown>)
        : {};
    const existingDirectory =
      existingMetadata.directory &&
      typeof existingMetadata.directory === "object" &&
      !Array.isArray(existingMetadata.directory)
        ? (existingMetadata.directory as Record<string, unknown>)
        : {};

    const directoryUpdates = Object.fromEntries(
      Object.entries(directoryConfig).filter(([, value]) => value !== undefined)
    );
    let nextDirectory: Record<string, unknown> = {
      ...existingDirectory,
      ...directoryUpdates,
    };
    if (peopleProvider === "okta") {
      nextDirectory = Object.fromEntries(
        Object.entries(nextDirectory).filter(
          ([key]) => key !== "apiToken" && key !== "oktaPrivateKeyKid"
        )
      );
    }
    nextDirectory = Object.fromEntries(
      Object.entries(nextDirectory).filter(([key]) => key !== "clientSecret")
    );
    nextDirectory = encryptDirectoryCredentialsForStorage(nextDirectory);
    const nextMetadata = {
      ...existingMetadata,
      directory: nextDirectory,
      peopleSync: {
        mode: "idp_pull" as const,
        provider: peopleProvider,
      },
    };

    await baseDb
      .update(tenantSsoConfigs)
      .set({
        metadata: nextMetadata,
        updatedAt: new Date(),
      })
      .where(eq(tenantSsoConfigs.id, config.id));

    invalidateTenantAccessContextCacheForTenant(tenantId);
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant people settings"
    );
  }
}

export async function listActivePeopleSyncTenants() {
  try {
    return await baseDb
      .select({
        metadata: tenantSsoConfigs.metadata,
        provider: tenantSsoConfigs.provider,
        slug: tenants.slug,
        tenantId: tenants.id,
      })
      .from(tenants)
      .innerJoin(tenantSsoConfigs, eq(tenantSsoConfigs.tenantId, tenants.id))
      .where(
        and(eq(tenants.status, "active"), eq(tenantSsoConfigs.status, "active"))
      );
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list active people sync tenants"
    );
  }
}

export async function upsertTenantMemberOnLogin({
  authUserId,
  email,
}: {
  authUserId: string;
  email: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1]?.toLowerCase();
  if (!domain) {
    return null;
  }

  try {
    const tenant = await getTenantByDomain(domain);
    if (tenant?.status !== "active") {
      return null;
    }

    const [existing] = await baseDb
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenant.id),
          eq(tenantMembers.authUserId, authUserId)
        )
      )
      .limit(1);

    const [adminContact] = await baseDb
      .select({ id: tenantAdminContacts.id })
      .from(tenantAdminContacts)
      .where(
        and(
          eq(tenantAdminContacts.tenantId, tenant.id),
          eq(tenantAdminContacts.email, normalizedEmail)
        )
      )
      .limit(1);

    const person = await getTenantPersonByEmail({
      email: normalizedEmail,
      tenantId: tenant.id,
    });

    const now = new Date();
    const role = adminContact ? "admin" : (existing?.role ?? "basic");
    const personIsInactive = person?.status === "inactive";

    if (existing) {
      const [updated] = await baseDb
        .update(tenantMembers)
        .set({
          email: normalizedEmail,
          personId: person?.id ?? existing.personId,
          role,
          ...(personIsInactive ? { isActive: false as const } : {}),
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(tenantMembers.id, existing.id))
        .returning();
      return updated ?? null;
    }

    // Do not create an active membership for an inactive IdP person.
    if (personIsInactive) {
      return null;
    }

    const [created] = await baseDb
      .insert(tenantMembers)
      .values({
        authUserId,
        createdAt: now,
        email: normalizedEmail,
        id: generateUUID(),
        isActive: true,
        lastLoginAt: now,
        personId: person?.id ?? null,
        role,
        tenantId: tenant.id,
        updatedAt: now,
      })
      .returning();

    return created ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to upsert tenant member on login"
    );
  }
}

export async function getTenantMembersBySlug(slug: string) {
  try {
    return await baseDb
      .select({
        authUserId: tenantMembers.authUserId,
        createdAt: tenantMembers.createdAt,
        displayName: tenantPeople.displayName,
        email: tenantMembers.email,
        firstName: tenantPeople.firstName,
        id: tenantMembers.id,
        image: authUser.image,
        isActive: tenantMembers.isActive,
        jobTitle: tenantMembers.jobTitle,
        lastLoginAt: tenantMembers.lastLoginAt,
        lastName: tenantPeople.lastName,
        memberDepartment: tenantMembers.department,
        personDepartment: tenantPeople.department,
        personId: tenantMembers.personId,
        personTitle: tenantPeople.title,
        role: tenantMembers.role,
        userName: authUser.name,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
      .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
      .where(eq(tenants.slug, slug))
      .orderBy(asc(tenantMembers.email));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list tenant members"
    );
  }
}

export async function getTenantMemberById({
  tenantId,
  memberId,
}: {
  tenantId: string;
  memberId: string;
}) {
  try {
    const [member] = await baseDb
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.id, memberId),
          eq(tenantMembers.tenantId, tenantId)
        )
      )
      .limit(1);
    return member ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to get tenant member"
    );
  }
}

export async function updateTenantMember({
  tenantId,
  memberId,
  role,
  isActive,
}: {
  tenantId: string;
  memberId: string;
  role?: TenantMemberRole;
  isActive?: boolean;
}) {
  try {
    if (isActive === true) {
      const [current] = await baseDb
        .select({ isActive: tenantMembers.isActive })
        .from(tenantMembers)
        .where(
          and(
            eq(tenantMembers.id, memberId),
            eq(tenantMembers.tenantId, tenantId)
          )
        )
        .limit(1);
      if (current && !current.isActive) {
        const { assertSeatAvailableForMember } = await import(
          "@/core/lib/billing/assert-seat-available"
        );
        await assertSeatAvailableForMember(tenantId);
      }
    }

    const updates: {
      role?: TenantMemberRole;
      isActive?: boolean;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (role !== undefined) {
      updates.role = role;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    const [updated] = await baseDb
      .update(tenantMembers)
      .set(updates)
      .where(
        and(
          eq(tenantMembers.id, memberId),
          eq(tenantMembers.tenantId, tenantId)
        )
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to update tenant member"
    );
  }
}

export async function isTenantMemberAccessAllowed({
  tenantId,
  authUserId,
}: {
  tenantId: string;
  authUserId: string;
}) {
  try {
    const [member] = await baseDb
      .select({ isActive: tenantMembers.isActive })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.authUserId, authUserId)
        )
      )
      .limit(1);

    // Fail closed: missing membership means no access (deactivated / never onboarded).
    if (!member) {
      return false;
    }

    return member.isActive;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to verify tenant member access"
    );
  }
}

export async function isTenantAdminEmail({
  tenantId,
  email,
}: {
  tenantId: string;
  email: string;
}) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const [adminContact] = await baseDb
      .select({ id: tenantAdminContacts.id })
      .from(tenantAdminContacts)
      .where(
        and(
          eq(tenantAdminContacts.tenantId, tenantId),
          eq(tenantAdminContacts.email, normalizedEmail)
        )
      )
      .limit(1);

    const [member] = await baseDb
      .select({
        id: tenantMembers.id,
        isActive: tenantMembers.isActive,
        role: tenantMembers.role,
      })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.email, normalizedEmail)
        )
      )
      .limit(1);

    // Admin contact or admin role only counts while membership is active.
    if (!member?.isActive) {
      return false;
    }

    if (adminContact) {
      return true;
    }

    return member.role === "admin";
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to verify tenant admin email"
    );
  }
}

export async function getTenantPersonByEmail({
  tenantId,
  email,
}: {
  tenantId: string;
  email: string;
}) {
  try {
    const [person] = await baseDb
      .select()
      .from(tenantPeople)
      .where(
        and(
          eq(tenantPeople.tenantId, tenantId),
          eq(tenantPeople.email, email.trim().toLowerCase())
        )
      )
      .limit(1);
    return person ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to get tenant person"
    );
  }
}

export async function getTenantAccessContextByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const preferredSlug = await readPreferredTenantSlug();
  const cacheKey = `${normalizedEmail}:${preferredSlug ?? ""}`;
  const nowMs = Date.now();
  const cached = tenantAccessContextByEmail.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.value;
  }

  try {
    let tenantId: string | null = null;
    let tenantSlug: string | null = null;

    const memberships = await baseDb
      .select({
        authUserId: tenantMembers.authUserId,
        tenantId: tenants.id,
        tenantSlug: tenants.slug,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMembers.email, normalizedEmail),
          eq(tenantMembers.isActive, true),
          eq(tenants.status, "active")
        )
      )
      .orderBy(asc(tenantMembers.createdAt));

    if (preferredSlug) {
      const preferred = memberships.find(
        (row) => row.tenantSlug === preferredSlug
      );
      if (preferred) {
        tenantId = preferred.tenantId;
        tenantSlug = preferred.tenantSlug;
      }
    }

    if (!tenantId && memberships[0]) {
      const domain = normalizedEmail.split("@")[1]?.toLowerCase();
      if (domain) {
        const domainTenantId = await getTenantIdByDomain(domain);
        const domainMatch = memberships.find(
          (row) => row.tenantId === domainTenantId
        );
        if (domainMatch) {
          tenantId = domainMatch.tenantId;
          tenantSlug = domainMatch.tenantSlug;
        }
      }
      if (!tenantId) {
        tenantId = memberships[0].tenantId;
        tenantSlug = memberships[0].tenantSlug;
      }
    }

    if (!tenantId) {
      const domain = normalizedEmail.split("@")[1]?.toLowerCase();
      if (!domain) {
        tenantAccessContextByEmail.set(cacheKey, {
          expiresAt: nowMs + TENANT_ACCESS_CONTEXT_CACHE_TTL_MS,
          value: null,
        });
        return null;
      }

      const [domainRow] = await baseDb
        .select({
          tenantId: tenants.id,
          tenantSlug: tenants.slug,
        })
        .from(tenantDomains)
        .innerJoin(tenants, eq(tenantDomains.tenantId, tenants.id))
        .where(
          and(eq(tenantDomains.domain, domain), eq(tenants.status, "active"))
        )
        .limit(1);

      if (!domainRow) {
        tenantAccessContextByEmail.set(cacheKey, {
          expiresAt: nowMs + TENANT_ACCESS_CONTEXT_CACHE_TTL_MS,
          value: null,
        });
        return null;
      }
      tenantId = domainRow.tenantId;
      tenantSlug = domainRow.tenantSlug;
    }

    const [row] = await baseDb
      .select({
        personLocation: tenantPeople.location,
        personStatus: tenantPeople.status,
        providerMetadata: tenantSsoConfigs.metadata,
      })
      .from(tenants)
      .leftJoin(
        tenantPeople,
        and(
          eq(tenantPeople.tenantId, tenants.id),
          eq(tenantPeople.email, normalizedEmail)
        )
      )
      .leftJoin(
        tenantSsoConfigs,
        and(
          eq(tenantSsoConfigs.tenantId, tenants.id),
          eq(tenantSsoConfigs.status, "active")
        )
      )
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!row || !tenantSlug) {
      tenantAccessContextByEmail.set(cacheKey, {
        expiresAt: nowMs + TENANT_ACCESS_CONTEXT_CACHE_TTL_MS,
        value: null,
      });
      return null;
    }

    const metadata =
      row.providerMetadata &&
      typeof row.providerMetadata === "object" &&
      !Array.isArray(row.providerMetadata)
        ? (row.providerMetadata as {
            directory?: { allowedOrgUnits?: string[] };
          })
        : null;
    const allowedOrgUnits = Array.isArray(metadata?.directory?.allowedOrgUnits)
      ? metadata.directory.allowedOrgUnits
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0)
      : [];

    // Self-serve / no directory: empty OU list means allow; no person row is fine.
    const value = {
      allowedOrgUnits,
      personOrgUnit: row.personLocation?.trim().toLowerCase() ?? null,
      personStatus: row.personStatus,
      tenantId,
      tenantSlug,
    };
    tenantAccessContextByEmail.set(cacheKey, {
      expiresAt: nowMs + TENANT_ACCESS_CONTEXT_CACHE_TTL_MS,
      value,
    });
    return value;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to get tenant access context"
    );
  }
}

export async function getAuthUserEmailById(userId: string) {
  try {
    const [row] = await baseDb
      .select({ email: authUser.email })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);
    return row?.email ?? null;
  } catch {
    return null;
  }
}

export async function insertSecurityAuditEvent({
  action,
  userId,
  email,
  tenantId,
  resource,
  ipAddress,
  userAgent,
  metadata,
}: {
  action: string;
  userId?: string | null;
  email?: string | null;
  tenantId?: string | null;
  resource?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await baseDb.insert(securityAuditEvents).values({
      action,
      email: email ?? null,
      ipAddress: ipAddress ?? null,
      metadata: metadata ?? null,
      resource: resource ?? null,
      tenantId: tenantId ?? null,
      userAgent: userAgent ?? null,
      userId: userId ?? null,
    });
  } catch {
    /* audit failure must never break auth or API flows */
  }
}
