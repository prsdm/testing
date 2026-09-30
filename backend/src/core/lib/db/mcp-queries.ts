import { and, desc, eq, inArray } from "drizzle-orm";
import { slugifyMcpServerName } from "@/core/lib/mcp/mcp-slug";
import { ChatbotError } from "@/shared/errors";
import { mcpServerListSubtitle } from "@/shared/mcp/server-list-subtitle";
import { getDb } from "./client";
import {
  mcpUserConnections,
  tenantMcpServerMembers,
  tenantMcpServers,
  tenantMembers,
} from "./tables";

const db = getDb();

export type McpAvailabilityMode = "everyone" | "selected";

export type TenantMcpServerRow = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  serverUrl: string;
  transport: "sse" | "streamable_http";
  authMode: "none" | "bearer";
  hasAuthToken: boolean;
  isEnabled: boolean;
  availabilityMode: McpAvailabilityMode;
  memberIds: string[];
  connectionsCount: number;
  createdAt: string;
  updatedAt: string;
};

function mapServerRow(
  row: typeof tenantMcpServers.$inferSelect,
  memberIds: string[],
  connectionsCount: number
): TenantMcpServerRow {
  return {
    authMode: row.authMode,
    availabilityMode: row.availabilityMode,
    connectionsCount,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    hasAuthToken: Boolean(row.authToken?.trim()),
    id: row.id,
    isEnabled: row.isEnabled,
    memberIds,
    name: row.name,
    serverUrl: row.serverUrl,
    slug: row.slug,
    tenantId: row.tenantId,
    transport: row.transport,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTenantMcpServersForAdmin(
  tenantId: string
): Promise<TenantMcpServerRow[]> {
  const rows = await db
    .select()
    .from(tenantMcpServers)
    .where(eq(tenantMcpServers.tenantId, tenantId))
    .orderBy(desc(tenantMcpServers.updatedAt));

  if (rows.length === 0) {
    return [];
  }

  const serverIds = rows.map((row) => row.id);
  const [memberRows, connectionRows] = await Promise.all([
    db
      .select()
      .from(tenantMcpServerMembers)
      .where(
        and(
          eq(tenantMcpServerMembers.tenantId, tenantId),
          inArray(tenantMcpServerMembers.serverId, serverIds)
        )
      ),
    db
      .select({ serverId: mcpUserConnections.serverId })
      .from(mcpUserConnections)
      .where(
        and(
          eq(mcpUserConnections.tenantId, tenantId),
          inArray(mcpUserConnections.serverId, serverIds)
        )
      ),
  ]);

  const membersByServer = new Map<string, string[]>();
  for (const member of memberRows) {
    const list = membersByServer.get(member.serverId) ?? [];
    list.push(member.memberId);
    membersByServer.set(member.serverId, list);
  }

  const connectionCountByServer = new Map<string, number>();
  for (const connection of connectionRows) {
    connectionCountByServer.set(
      connection.serverId,
      (connectionCountByServer.get(connection.serverId) ?? 0) + 1
    );
  }

  return rows.map((row) =>
    mapServerRow(
      row,
      membersByServer.get(row.id) ?? [],
      connectionCountByServer.get(row.id) ?? 0
    )
  );
}

export async function getTenantMcpServerById(args: {
  tenantId: string;
  serverId: string;
}) {
  const [row] = await db
    .select()
    .from(tenantMcpServers)
    .where(
      and(
        eq(tenantMcpServers.tenantId, args.tenantId),
        eq(tenantMcpServers.id, args.serverId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [memberRows, connectionRows] = await Promise.all([
    db
      .select({ memberId: tenantMcpServerMembers.memberId })
      .from(tenantMcpServerMembers)
      .where(
        and(
          eq(tenantMcpServerMembers.tenantId, args.tenantId),
          eq(tenantMcpServerMembers.serverId, args.serverId)
        )
      ),
    db
      .select({ serverId: mcpUserConnections.serverId })
      .from(mcpUserConnections)
      .where(
        and(
          eq(mcpUserConnections.tenantId, args.tenantId),
          eq(mcpUserConnections.serverId, args.serverId)
        )
      ),
  ]);

  return mapServerRow(
    row,
    memberRows.map((entry) => entry.memberId),
    connectionRows.length
  );
}

export async function getTenantMcpServerSecretsById(args: {
  tenantId: string;
  serverId: string;
}) {
  const [row] = await db
    .select()
    .from(tenantMcpServers)
    .where(
      and(
        eq(tenantMcpServers.tenantId, args.tenantId),
        eq(tenantMcpServers.id, args.serverId)
      )
    )
    .limit(1);
  return row ?? null;
}

async function ensureUniqueSlug(tenantId: string, baseSlug: string) {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: tenantMcpServers.id })
      .from(tenantMcpServers)
      .where(
        and(
          eq(tenantMcpServers.tenantId, tenantId),
          eq(tenantMcpServers.slug, slug)
        )
      )
      .limit(1);
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug.slice(0, 58)}-${suffix}`;
    suffix += 1;
  }
}

export async function createTenantMcpServer(args: {
  tenantId: string;
  name: string;
  description?: string | null;
  serverUrl: string;
  transport: "sse" | "streamable_http";
  authMode: "none" | "bearer";
  authToken?: string | null;
  isEnabled?: boolean;
  availabilityMode?: McpAvailabilityMode;
  memberIds?: string[];
}) {
  const slug = await ensureUniqueSlug(
    args.tenantId,
    slugifyMcpServerName(args.name)
  );

  try {
    const [row] = await db
      .insert(tenantMcpServers)
      .values({
        authMode: args.authMode,
        authToken: args.authToken?.trim() || null,
        availabilityMode: args.availabilityMode ?? "everyone",
        description: args.description?.trim() || null,
        isEnabled: args.isEnabled ?? false,
        name: args.name.trim(),
        serverUrl: args.serverUrl.trim(),
        slug,
        tenantId: args.tenantId,
        transport: args.transport,
      })
      .returning();

    if (!row) {
      throw new Error("Insert failed");
    }

    if (args.availabilityMode === "selected" && args.memberIds?.length) {
      await db.insert(tenantMcpServerMembers).values(
        args.memberIds.map((memberId) => ({
          memberId,
          serverId: row.id,
          tenantId: args.tenantId,
        }))
      );
    }

    return getTenantMcpServerById({
      serverId: row.id,
      tenantId: args.tenantId,
    });
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to create MCP server"
    );
  }
}

export async function updateTenantMcpServer(args: {
  tenantId: string;
  serverId: string;
  name?: string;
  description?: string | null;
  serverUrl?: string;
  transport?: "sse" | "streamable_http";
  authMode?: "none" | "bearer";
  authToken?: string | null;
  clearAuthToken?: boolean;
  isEnabled?: boolean;
  availabilityMode?: McpAvailabilityMode;
  memberIds?: string[];
}) {
  const existing = await getTenantMcpServerSecretsById({
    serverId: args.serverId,
    tenantId: args.tenantId,
  });
  if (!existing) {
    throw new ChatbotError("not_found:api", "MCP server not found");
  }

  const nextAuthToken = args.clearAuthToken
    ? null
    : args.authToken === undefined
      ? existing.authToken
      : args.authToken?.trim() || null;

  await db
    .update(tenantMcpServers)
    .set({
      ...(args.name === undefined ? {} : { name: args.name.trim() }),
      ...(args.description === undefined
        ? {}
        : { description: args.description?.trim() || null }),
      ...(args.serverUrl === undefined
        ? {}
        : { serverUrl: args.serverUrl.trim() }),
      ...(args.transport === undefined ? {} : { transport: args.transport }),
      ...(args.authMode === undefined ? {} : { authMode: args.authMode }),
      authToken: nextAuthToken,
      ...(args.isEnabled === undefined ? {} : { isEnabled: args.isEnabled }),
      ...(args.availabilityMode === undefined
        ? {}
        : { availabilityMode: args.availabilityMode }),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantMcpServers.tenantId, args.tenantId),
        eq(tenantMcpServers.id, args.serverId)
      )
    );

  if (args.availabilityMode !== undefined || args.memberIds !== undefined) {
    await db
      .delete(tenantMcpServerMembers)
      .where(
        and(
          eq(tenantMcpServerMembers.tenantId, args.tenantId),
          eq(tenantMcpServerMembers.serverId, args.serverId)
        )
      );

    const mode = args.availabilityMode ?? existing.availabilityMode;
    if (mode === "selected" && args.memberIds?.length) {
      await db.insert(tenantMcpServerMembers).values(
        args.memberIds.map((memberId) => ({
          memberId,
          serverId: args.serverId,
          tenantId: args.tenantId,
        }))
      );
    }
  }

  return getTenantMcpServerById({
    serverId: args.serverId,
    tenantId: args.tenantId,
  });
}

export async function deleteTenantMcpServer(args: {
  tenantId: string;
  serverId: string;
}) {
  await db
    .delete(tenantMcpServers)
    .where(
      and(
        eq(tenantMcpServers.tenantId, args.tenantId),
        eq(tenantMcpServers.id, args.serverId)
      )
    );
}

async function memberIdForUser(tenantId: string, authUserId: string) {
  const [row] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.authUserId, authUserId)
      )
    )
    .limit(1);
  return row?.id ?? null;
}

function serverAvailableToMember(
  server: typeof tenantMcpServers.$inferSelect,
  memberIds: string[],
  memberId: string | null
) {
  if (!server.isEnabled) {
    return false;
  }
  if (server.availabilityMode === "everyone") {
    return true;
  }
  if (!memberId) {
    return false;
  }
  return memberIds.includes(memberId);
}

export async function listMcpServersForConnectorsPage(args: {
  tenantId: string;
  authUserId: string;
}) {
  const memberId = await memberIdForUser(args.tenantId, args.authUserId);
  const rows = await db
    .select()
    .from(tenantMcpServers)
    .where(eq(tenantMcpServers.tenantId, args.tenantId))
    .orderBy(desc(tenantMcpServers.name));

  if (rows.length === 0) {
    return [];
  }

  const serverIds = rows.map((row) => row.id);
  const [memberRows, connections] = await Promise.all([
    db
      .select()
      .from(tenantMcpServerMembers)
      .where(
        and(
          eq(tenantMcpServerMembers.tenantId, args.tenantId),
          inArray(tenantMcpServerMembers.serverId, serverIds)
        )
      ),
    db
      .select()
      .from(mcpUserConnections)
      .where(
        and(
          eq(mcpUserConnections.tenantId, args.tenantId),
          eq(mcpUserConnections.authUserId, args.authUserId),
          inArray(mcpUserConnections.serverId, serverIds)
        )
      ),
  ]);

  const membersByServer = new Map<string, string[]>();
  for (const member of memberRows) {
    const list = membersByServer.get(member.serverId) ?? [];
    list.push(member.memberId);
    membersByServer.set(member.serverId, list);
  }

  const connectedIds = new Set(connections.map((row) => row.serverId));

  return rows
    .filter((row) =>
      serverAvailableToMember(row, membersByServer.get(row.id) ?? [], memberId)
    )
    .map((row) => ({
      connected: connectedIds.has(row.id),
      description: mcpServerListSubtitle({
        description: row.description,
        serverUrl: row.serverUrl,
        transport: row.transport,
      }),
      id: row.id,
      name: row.name,
      serverConfigured: Boolean(row.serverUrl.trim()),
      slug: row.slug,
      transport: row.transport,
    }));
}

export async function connectMcpServerForUser(args: {
  tenantId: string;
  authUserId: string;
  serverId: string;
}) {
  const memberId = await memberIdForUser(args.tenantId, args.authUserId);
  const server = await getTenantMcpServerSecretsById({
    serverId: args.serverId,
    tenantId: args.tenantId,
  });
  if (!server) {
    throw new ChatbotError("not_found:api", "MCP server not found");
  }

  const memberRows = await db
    .select({ memberId: tenantMcpServerMembers.memberId })
    .from(tenantMcpServerMembers)
    .where(
      and(
        eq(tenantMcpServerMembers.tenantId, args.tenantId),
        eq(tenantMcpServerMembers.serverId, args.serverId)
      )
    );

  if (
    !serverAvailableToMember(
      server,
      memberRows.map((row) => row.memberId),
      memberId
    )
  ) {
    throw new ChatbotError(
      "forbidden:api",
      "This MCP server is not available."
    );
  }

  await db
    .insert(mcpUserConnections)
    .values({
      authUserId: args.authUserId,
      serverId: args.serverId,
      tenantId: args.tenantId,
    })
    .onConflictDoUpdate({
      set: { connectedAt: new Date() },
      target: [mcpUserConnections.serverId, mcpUserConnections.authUserId],
    });
}

export async function disconnectMcpServerForUser(args: {
  tenantId: string;
  authUserId: string;
  serverId: string;
}) {
  await db
    .delete(mcpUserConnections)
    .where(
      and(
        eq(mcpUserConnections.tenantId, args.tenantId),
        eq(mcpUserConnections.authUserId, args.authUserId),
        eq(mcpUserConnections.serverId, args.serverId)
      )
    );
}

export async function listConnectedMcpServersForChat(args: {
  tenantId: string;
  authUserId: string;
}) {
  const rows = await db
    .select({ server: tenantMcpServers })
    .from(mcpUserConnections)
    .innerJoin(
      tenantMcpServers,
      eq(mcpUserConnections.serverId, tenantMcpServers.id)
    )
    .where(
      and(
        eq(mcpUserConnections.tenantId, args.tenantId),
        eq(mcpUserConnections.authUserId, args.authUserId),
        eq(tenantMcpServers.isEnabled, true)
      )
    );

  return rows.map((row) => row.server);
}
