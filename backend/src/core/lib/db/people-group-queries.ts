import { and, asc, count, eq, inArray } from "drizzle-orm";
import { ChatbotError } from "@/shared/errors";
import { generateUUID } from "@/shared/utils";
import { getDb } from "./client";
import {
  linkTenantMembersPersonIdByEmail,
  upsertTenantPerson,
} from "./queries";
import {
  authUser,
  tenantMembers,
  tenantPeople,
  tenantPeopleGroupMembers,
  tenantPeopleGroups,
} from "./tables";

const db = getDb();

export type TenantGroupListRow = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: Date;
};

export type TenantGroupMemberRow = {
  personId: string;
  email: string;
  displayName: string;
  image: string | null;
};

export type TenantGroupDetail = {
  id: string;
  name: string;
  members: TenantGroupMemberRow[];
};

export type GroupMemberPickerOption = {
  memberId: string;
  personId: string | null;
  email: string;
  displayName: string;
  image: string | null;
};

function memberDisplayName(args: {
  displayName?: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) {
  return (
    args.displayName?.trim() ||
    args.userName?.trim() ||
    `${args.firstName ?? ""} ${args.lastName ?? ""}`.trim() ||
    args.email.split("@")[0]
  );
}

export async function listTenantPeopleGroups(
  tenantId: string
): Promise<TenantGroupListRow[]> {
  try {
    const rows = await db
      .select({
        createdAt: tenantPeopleGroups.createdAt,
        id: tenantPeopleGroups.id,
        memberCount: count(tenantPeopleGroupMembers.id),
        name: tenantPeopleGroups.name,
      })
      .from(tenantPeopleGroups)
      .leftJoin(
        tenantPeopleGroupMembers,
        eq(tenantPeopleGroupMembers.groupId, tenantPeopleGroups.id)
      )
      .where(eq(tenantPeopleGroups.tenantId, tenantId))
      .groupBy(
        tenantPeopleGroups.id,
        tenantPeopleGroups.name,
        tenantPeopleGroups.createdAt
      )
      .orderBy(asc(tenantPeopleGroups.name));

    return rows.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      memberCount: Number(row.memberCount),
      name: row.name,
    }));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to list groups"
    );
  }
}

export async function getTenantPeopleGroupDetail({
  tenantId,
  groupId,
}: {
  tenantId: string;
  groupId: string;
}): Promise<TenantGroupDetail | null> {
  try {
    const [group] = await db
      .select({
        id: tenantPeopleGroups.id,
        name: tenantPeopleGroups.name,
      })
      .from(tenantPeopleGroups)
      .where(
        and(
          eq(tenantPeopleGroups.tenantId, tenantId),
          eq(tenantPeopleGroups.id, groupId)
        )
      )
      .limit(1);

    if (!group) {
      return null;
    }

    const memberRows = await db
      .select({
        displayName: tenantPeople.displayName,
        email: tenantPeople.email,
        firstName: tenantPeople.firstName,
        image: authUser.image,
        lastName: tenantPeople.lastName,
        personId: tenantPeople.id,
        userName: authUser.name,
      })
      .from(tenantPeopleGroupMembers)
      .innerJoin(
        tenantPeople,
        eq(tenantPeopleGroupMembers.personId, tenantPeople.id)
      )
      .leftJoin(
        tenantMembers,
        and(
          eq(tenantMembers.personId, tenantPeople.id),
          eq(tenantMembers.tenantId, tenantId)
        )
      )
      .leftJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
      .where(
        and(
          eq(tenantPeopleGroupMembers.tenantId, tenantId),
          eq(tenantPeopleGroupMembers.groupId, groupId)
        )
      )
      .orderBy(asc(tenantPeople.email));

    return {
      id: group.id,
      members: memberRows.map((row) => ({
        displayName: memberDisplayName({
          displayName: row.displayName,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          userName: row.userName,
        }),
        email: row.email,
        image: row.image,
        personId: row.personId,
      })),
      name: group.name,
    };
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to load group"
    );
  }
}

export async function createTenantPeopleGroup({
  tenantId,
  name,
}: {
  tenantId: string;
  name: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new ChatbotError("bad_request:api", "Group name is required.");
  }

  const now = new Date();

  try {
    const [created] = await db
      .insert(tenantPeopleGroups)
      .values({
        createdAt: now,
        id: generateUUID(),
        name: trimmedName,
        tenantId,
        updatedAt: now,
      })
      .returning();

    return created ?? null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create group";
    if (message.includes("tenant_people_group_tenant_name_unique")) {
      throw new ChatbotError(
        "bad_request:api",
        "A group with this name already exists."
      );
    }
    throw new ChatbotError("bad_request:database", message);
  }
}

export async function updateTenantPeopleGroup({
  tenantId,
  groupId,
  name,
}: {
  tenantId: string;
  groupId: string;
  name: string;
}) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new ChatbotError("bad_request:api", "Group name is required.");
  }

  try {
    const [updated] = await db
      .update(tenantPeopleGroups)
      .set({
        name: trimmedName,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantPeopleGroups.tenantId, tenantId),
          eq(tenantPeopleGroups.id, groupId)
        )
      )
      .returning();

    return updated ?? null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update group";
    if (message.includes("tenant_people_group_tenant_name_unique")) {
      throw new ChatbotError(
        "bad_request:api",
        "A group with this name already exists."
      );
    }
    throw new ChatbotError("bad_request:database", message);
  }
}

export async function deleteTenantPeopleGroup({
  tenantId,
  groupId,
}: {
  tenantId: string;
  groupId: string;
}) {
  try {
    await db
      .delete(tenantPeopleGroupMembers)
      .where(
        and(
          eq(tenantPeopleGroupMembers.tenantId, tenantId),
          eq(tenantPeopleGroupMembers.groupId, groupId)
        )
      );

    const [deleted] = await db
      .delete(tenantPeopleGroups)
      .where(
        and(
          eq(tenantPeopleGroups.tenantId, tenantId),
          eq(tenantPeopleGroups.id, groupId)
        )
      )
      .returning({ id: tenantPeopleGroups.id });

    return deleted ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to delete group"
    );
  }
}

async function resolvePersonIdForMember({
  tenantId,
  memberId,
}: {
  tenantId: string;
  memberId: string;
}) {
  const [member] = await db
    .select({
      department: tenantMembers.department,
      email: tenantMembers.email,
      id: tenantMembers.id,
      jobTitle: tenantMembers.jobTitle,
      personId: tenantMembers.personId,
    })
    .from(tenantMembers)
    .where(
      and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.id, memberId))
    )
    .limit(1);

  if (!member) {
    throw new ChatbotError("bad_request:api", "Member not found.");
  }

  if (member.personId) {
    return member.personId;
  }

  const person = await upsertTenantPerson({
    department: member.department,
    email: member.email,
    status: "active",
    tenantId,
    title: member.jobTitle,
  });

  if (!person) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to resolve directory person for member."
    );
  }

  await db
    .update(tenantMembers)
    .set({ personId: person.id, updatedAt: new Date() })
    .where(eq(tenantMembers.id, member.id));

  await linkTenantMembersPersonIdByEmail(tenantId);

  return person.id;
}

export async function addTenantPeopleGroupMembers({
  tenantId,
  groupId,
  memberIds,
}: {
  tenantId: string;
  groupId: string;
  memberIds: string[];
}) {
  if (memberIds.length === 0) {
    return [];
  }

  const group = await getTenantPeopleGroupDetail({ groupId, tenantId });
  if (!group) {
    throw new ChatbotError("bad_request:api", "Group not found.");
  }

  const personIds = await Promise.all(
    memberIds.map((memberId) =>
      resolvePersonIdForMember({ memberId, tenantId })
    )
  );

  const uniquePersonIds = [...new Set(personIds)];
  const existingRows = await db
    .select({ personId: tenantPeopleGroupMembers.personId })
    .from(tenantPeopleGroupMembers)
    .where(
      and(
        eq(tenantPeopleGroupMembers.tenantId, tenantId),
        eq(tenantPeopleGroupMembers.groupId, groupId),
        inArray(tenantPeopleGroupMembers.personId, uniquePersonIds)
      )
    );

  const existingPersonIds = new Set(existingRows.map((row) => row.personId));
  const personIdsToAdd = uniquePersonIds.filter(
    (personId) => !existingPersonIds.has(personId)
  );

  if (personIdsToAdd.length === 0) {
    return [];
  }

  const now = new Date();

  try {
    const inserted = await db
      .insert(tenantPeopleGroupMembers)
      .values(
        personIdsToAdd.map((personId) => ({
          createdAt: now,
          groupId,
          id: generateUUID(),
          personId,
          tenantId,
        }))
      )
      .returning({ personId: tenantPeopleGroupMembers.personId });

    return inserted.map((row) => row.personId);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to add group members"
    );
  }
}

export async function removeTenantPeopleGroupMember({
  tenantId,
  groupId,
  personId,
}: {
  tenantId: string;
  groupId: string;
  personId: string;
}) {
  try {
    const [removed] = await db
      .delete(tenantPeopleGroupMembers)
      .where(
        and(
          eq(tenantPeopleGroupMembers.tenantId, tenantId),
          eq(tenantPeopleGroupMembers.groupId, groupId),
          eq(tenantPeopleGroupMembers.personId, personId)
        )
      )
      .returning({ personId: tenantPeopleGroupMembers.personId });

    return removed ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to remove group member"
    );
  }
}

export async function listGroupMemberPickerOptions(
  tenantId: string
): Promise<GroupMemberPickerOption[]> {
  try {
    const rows = await db
      .select({
        displayName: tenantPeople.displayName,
        email: tenantMembers.email,
        firstName: tenantPeople.firstName,
        image: authUser.image,
        lastName: tenantPeople.lastName,
        memberId: tenantMembers.id,
        personId: tenantMembers.personId,
        userName: authUser.name,
      })
      .from(tenantMembers)
      .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
      .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.isActive, true)
        )
      )
      .orderBy(asc(tenantMembers.email));

    return rows.map((row) => ({
      displayName: memberDisplayName({
        displayName: row.displayName,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        userName: row.userName,
      }),
      email: row.email,
      image: row.image,
      memberId: row.memberId,
      personId: row.personId,
    }));
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list members for group picker"
    );
  }
}
