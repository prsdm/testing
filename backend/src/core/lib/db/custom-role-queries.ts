import { and, asc, count, eq, inArray } from "drizzle-orm";
import {
  type CapabilityId,
  isCapabilityId,
  resolveCapabilitiesFromParts,
} from "@/shared/auth/capabilities";
import { ChatbotError } from "@/shared/errors";
import { generateUUID } from "@/shared/utils";
import { getDb } from "./client";
import { isTenantAdminEmail } from "./queries";
import {
  tenantCustomRoleCapabilities,
  tenantCustomRoles,
  tenantMemberCustomRoles,
  tenantMembers,
} from "./tables";

const db = getDb();

export type CustomRoleListRow = {
  id: string;
  name: string;
  description: string | null;
  capabilityIds: CapabilityId[];
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomRoleDetail = {
  id: string;
  name: string;
  description: string | null;
  capabilityIds: CapabilityId[];
  createdAt: Date;
  updatedAt: Date;
};

function parseCapabilityIds(values: string[]): CapabilityId[] {
  const unique = new Set<CapabilityId>();
  for (const value of values) {
    if (isCapabilityId(value)) {
      unique.add(value);
    }
  }
  return [...unique];
}

export async function listTenantCustomRoles(
  tenantId: string
): Promise<CustomRoleListRow[]> {
  try {
    const roles = await db
      .select({
        createdAt: tenantCustomRoles.createdAt,
        description: tenantCustomRoles.description,
        id: tenantCustomRoles.id,
        memberCount: count(tenantMemberCustomRoles.memberId),
        name: tenantCustomRoles.name,
        updatedAt: tenantCustomRoles.updatedAt,
      })
      .from(tenantCustomRoles)
      .leftJoin(
        tenantMemberCustomRoles,
        eq(tenantMemberCustomRoles.roleId, tenantCustomRoles.id)
      )
      .where(eq(tenantCustomRoles.tenantId, tenantId))
      .groupBy(
        tenantCustomRoles.id,
        tenantCustomRoles.name,
        tenantCustomRoles.description,
        tenantCustomRoles.createdAt,
        tenantCustomRoles.updatedAt
      )
      .orderBy(asc(tenantCustomRoles.name));

    if (roles.length === 0) {
      return [];
    }

    const capabilityRows = await db
      .select({
        capability: tenantCustomRoleCapabilities.capability,
        roleId: tenantCustomRoleCapabilities.roleId,
      })
      .from(tenantCustomRoleCapabilities)
      .where(
        inArray(
          tenantCustomRoleCapabilities.roleId,
          roles.map((role) => role.id)
        )
      );

    const capabilitiesByRole = new Map<string, CapabilityId[]>();
    for (const row of capabilityRows) {
      if (!isCapabilityId(row.capability)) {
        continue;
      }
      const current = capabilitiesByRole.get(row.roleId) ?? [];
      current.push(row.capability);
      capabilitiesByRole.set(row.roleId, current);
    }

    return roles.map((role) => ({
      capabilityIds: capabilitiesByRole.get(role.id) ?? [],
      createdAt: role.createdAt,
      description: role.description,
      id: role.id,
      memberCount: Number(role.memberCount),
      name: role.name,
      updatedAt: role.updatedAt,
    }));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list roles"
    );
  }
}

export async function getTenantCustomRoleDetail({
  tenantId,
  roleId,
}: {
  tenantId: string;
  roleId: string;
}): Promise<CustomRoleDetail | null> {
  try {
    const [role] = await db
      .select({
        createdAt: tenantCustomRoles.createdAt,
        description: tenantCustomRoles.description,
        id: tenantCustomRoles.id,
        name: tenantCustomRoles.name,
        updatedAt: tenantCustomRoles.updatedAt,
      })
      .from(tenantCustomRoles)
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          eq(tenantCustomRoles.id, roleId)
        )
      )
      .limit(1);

    if (!role) {
      return null;
    }

    const capabilityRows = await db
      .select({ capability: tenantCustomRoleCapabilities.capability })
      .from(tenantCustomRoleCapabilities)
      .where(eq(tenantCustomRoleCapabilities.roleId, roleId));

    return {
      capabilityIds: parseCapabilityIds(
        capabilityRows.map((row) => row.capability)
      ),
      createdAt: role.createdAt,
      description: role.description,
      id: role.id,
      name: role.name,
      updatedAt: role.updatedAt,
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to load role"
    );
  }
}

async function replaceRoleCapabilities({
  roleId,
  capabilityIds,
}: {
  roleId: string;
  capabilityIds: CapabilityId[];
}) {
  await db
    .delete(tenantCustomRoleCapabilities)
    .where(eq(tenantCustomRoleCapabilities.roleId, roleId));

  const unique = parseCapabilityIds(capabilityIds);
  if (unique.length === 0) {
    return;
  }

  await db.insert(tenantCustomRoleCapabilities).values(
    unique.map((capability) => ({
      capability,
      roleId,
    }))
  );
}

export async function createTenantCustomRole({
  tenantId,
  name,
  description,
  capabilityIds,
}: {
  tenantId: string;
  name: string;
  description?: string | null;
  capabilityIds: CapabilityId[];
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new ChatbotError("bad_request:api", "Role name is required.");
  }

  const now = new Date();
  const id = generateUUID();

  try {
    const [created] = await db
      .insert(tenantCustomRoles)
      .values({
        createdAt: now,
        description: description?.trim() || null,
        id,
        name: trimmedName,
        tenantId,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      return null;
    }

    await replaceRoleCapabilities({
      capabilityIds,
      roleId: created.id,
    });

    return getTenantCustomRoleDetail({ roleId: created.id, tenantId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create role";
    if (message.includes("tenant_custom_role_tenant_name_unique")) {
      throw new ChatbotError(
        "bad_request:api",
        "A role with this name already exists."
      );
    }
    throw new ChatbotError("bad_request:database", message);
  }
}

export async function updateTenantCustomRole({
  tenantId,
  roleId,
  name,
  description,
  capabilityIds,
}: {
  tenantId: string;
  roleId: string;
  name?: string;
  description?: string | null;
  capabilityIds?: CapabilityId[];
}) {
  const existing = await getTenantCustomRoleDetail({ roleId, tenantId });
  if (!existing) {
    return null;
  }

  const updates: {
    name?: string;
    description?: string | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new ChatbotError("bad_request:api", "Role name is required.");
    }
    updates.name = trimmedName;
  }

  if (description !== undefined) {
    updates.description = description?.trim() || null;
  }

  try {
    await db
      .update(tenantCustomRoles)
      .set(updates)
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          eq(tenantCustomRoles.id, roleId)
        )
      );

    if (capabilityIds !== undefined) {
      await replaceRoleCapabilities({ capabilityIds, roleId });
    }

    return getTenantCustomRoleDetail({ roleId, tenantId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role";
    if (message.includes("tenant_custom_role_tenant_name_unique")) {
      throw new ChatbotError(
        "bad_request:api",
        "A role with this name already exists."
      );
    }
    throw new ChatbotError("bad_request:database", message);
  }
}

export async function deleteTenantCustomRole({
  tenantId,
  roleId,
}: {
  tenantId: string;
  roleId: string;
}) {
  try {
    await db
      .delete(tenantMemberCustomRoles)
      .where(eq(tenantMemberCustomRoles.roleId, roleId));

    await db
      .delete(tenantCustomRoleCapabilities)
      .where(eq(tenantCustomRoleCapabilities.roleId, roleId));

    const [deleted] = await db
      .delete(tenantCustomRoles)
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          eq(tenantCustomRoles.id, roleId)
        )
      )
      .returning({ id: tenantCustomRoles.id });

    return deleted ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to delete role"
    );
  }
}

export async function listMemberCustomRoleIds({
  tenantId,
  memberIds,
}: {
  tenantId: string;
  memberIds: string[];
}): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (memberIds.length === 0) {
    return result;
  }

  try {
    const rows = await db
      .select({
        memberId: tenantMemberCustomRoles.memberId,
        roleId: tenantMemberCustomRoles.roleId,
      })
      .from(tenantMemberCustomRoles)
      .innerJoin(
        tenantCustomRoles,
        eq(tenantMemberCustomRoles.roleId, tenantCustomRoles.id)
      )
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          inArray(tenantMemberCustomRoles.memberId, memberIds)
        )
      );

    for (const row of rows) {
      const current = result.get(row.memberId) ?? [];
      current.push(row.roleId);
      result.set(row.memberId, current);
    }

    return result;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list member custom roles"
    );
  }
}

export async function setMemberCustomRoles({
  tenantId,
  memberId,
  roleIds,
}: {
  tenantId: string;
  memberId: string;
  roleIds: string[];
}) {
  const [member] = await db
    .select({
      id: tenantMembers.id,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .where(
      and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.id, memberId))
    )
    .limit(1);

  if (!member) {
    throw new ChatbotError("bad_request:api", "Member not found.");
  }

  if (member.role === "admin") {
    // Full admins already have every capability; clear custom role links.
    await db
      .delete(tenantMemberCustomRoles)
      .where(eq(tenantMemberCustomRoles.memberId, memberId));
    return [];
  }

  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length > 0) {
    const validRoles = await db
      .select({ id: tenantCustomRoles.id })
      .from(tenantCustomRoles)
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          inArray(tenantCustomRoles.id, uniqueRoleIds)
        )
      );

    if (validRoles.length !== uniqueRoleIds.length) {
      throw new ChatbotError(
        "bad_request:api",
        "One or more roles are invalid."
      );
    }
  }

  try {
    await db
      .delete(tenantMemberCustomRoles)
      .where(eq(tenantMemberCustomRoles.memberId, memberId));

    if (uniqueRoleIds.length === 0) {
      return [];
    }

    await db.insert(tenantMemberCustomRoles).values(
      uniqueRoleIds.map((roleId) => ({
        createdAt: new Date(),
        memberId,
        roleId,
      }))
    );

    return uniqueRoleIds;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update member custom roles"
    );
  }
}

export async function listCustomCapabilitiesForMember({
  tenantId,
  memberId,
}: {
  tenantId: string;
  memberId: string;
}): Promise<CapabilityId[]> {
  try {
    const rows = await db
      .select({ capability: tenantCustomRoleCapabilities.capability })
      .from(tenantMemberCustomRoles)
      .innerJoin(
        tenantCustomRoles,
        eq(tenantMemberCustomRoles.roleId, tenantCustomRoles.id)
      )
      .innerJoin(
        tenantCustomRoleCapabilities,
        eq(tenantCustomRoleCapabilities.roleId, tenantCustomRoles.id)
      )
      .where(
        and(
          eq(tenantCustomRoles.tenantId, tenantId),
          eq(tenantMemberCustomRoles.memberId, memberId)
        )
      );

    return parseCapabilityIds(rows.map((row) => row.capability));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list member capabilities"
    );
  }
}

export async function resolveCapabilitiesForEmail({
  tenantId,
  email,
}: {
  tenantId: string;
  email: string;
}): Promise<Set<CapabilityId>> {
  const normalizedEmail = email.trim().toLowerCase();
  const isFullAdmin = await isTenantAdminEmail({
    email: normalizedEmail,
    tenantId,
  });

  if (isFullAdmin) {
    return resolveCapabilitiesFromParts({
      customCapabilities: [],
      isFullAdmin: true,
    });
  }

  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.email, normalizedEmail),
        eq(tenantMembers.isActive, true)
      )
    )
    .limit(1);

  if (!member) {
    return resolveCapabilitiesFromParts({
      customCapabilities: [],
      isFullAdmin: false,
    });
  }

  const [customRoleAssignment] = await db
    .select({ roleId: tenantMemberCustomRoles.roleId })
    .from(tenantMemberCustomRoles)
    .where(eq(tenantMemberCustomRoles.memberId, member.id))
    .limit(1);

  const hasCustomRole = Boolean(customRoleAssignment);
  const customCapabilities = hasCustomRole
    ? await listCustomCapabilitiesForMember({
        memberId: member.id,
        tenantId,
      })
    : [];

  return resolveCapabilitiesFromParts({
    customCapabilities,
    hasCustomRole,
    isFullAdmin: false,
  });
}
