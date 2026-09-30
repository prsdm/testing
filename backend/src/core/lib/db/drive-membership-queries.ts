import { and, eq } from "drizzle-orm";
import { getDb } from "./client";
import {
  tenantDrivePublicExternalGroups,
  tenantDriveUserExternalGroups,
} from "./tables";

const UPSERT_BATCH_SIZE = 5000;

const db = getDb();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function markTenantDriveExternalGroupsStale(tenantId: string) {
  await db
    .update(tenantDriveUserExternalGroups)
    .set({ stale: true })
    .where(eq(tenantDriveUserExternalGroups.tenantId, tenantId));
  await db
    .update(tenantDrivePublicExternalGroups)
    .set({ stale: true })
    .where(eq(tenantDrivePublicExternalGroups.tenantId, tenantId));
}

export async function removeStaleTenantDriveExternalGroups(tenantId: string) {
  await db
    .delete(tenantDriveUserExternalGroups)
    .where(
      and(
        eq(tenantDriveUserExternalGroups.tenantId, tenantId),
        eq(tenantDriveUserExternalGroups.stale, true)
      )
    );
  await db
    .delete(tenantDrivePublicExternalGroups)
    .where(
      and(
        eq(tenantDrivePublicExternalGroups.tenantId, tenantId),
        eq(tenantDrivePublicExternalGroups.stale, true)
      )
    );
}

export async function upsertTenantDriveUserGoogleGroupMemberships(input: {
  tenantId: string;
  userEmail: string;
  externalGroupIds: string[];
}) {
  const userEmail = normalizeEmail(input.userEmail);
  const uniqueIds = [
    ...new Set(
      input.externalGroupIds
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (uniqueIds.length === 0) {
    return;
  }

  for (let offset = 0; offset < uniqueIds.length; offset += UPSERT_BATCH_SIZE) {
    const chunk = uniqueIds.slice(offset, offset + UPSERT_BATCH_SIZE);
    await db
      .insert(tenantDriveUserExternalGroups)
      .values(
        chunk.map((externalGroupId) => ({
          externalGroupId,
          stale: false,
          tenantId: input.tenantId,
          userEmail,
        }))
      )
      .onConflictDoUpdate({
        set: { stale: false, updatedAt: new Date() },
        target: [
          tenantDriveUserExternalGroups.tenantId,
          tenantDriveUserExternalGroups.userEmail,
          tenantDriveUserExternalGroups.externalGroupId,
        ],
      });
  }
}

export async function upsertTenantDriveResourceMembershipGroups(input: {
  tenantId: string;
  membershipGroups: Array<{
    externalGroupId: string;
    memberEmails: string[];
    grantsPublicAccess?: boolean;
  }>;
}) {
  const userRows: Array<{
    tenantId: string;
    userEmail: string;
    externalGroupId: string;
    stale: boolean;
  }> = [];
  const publicRows: Array<{
    tenantId: string;
    externalGroupId: string;
    stale: boolean;
  }> = [];

  for (const group of input.membershipGroups) {
    const externalGroupId = group.externalGroupId.trim().toLowerCase();
    if (!externalGroupId) {
      continue;
    }
    const memberEmails = new Set(
      group.memberEmails.map((email) => normalizeEmail(email)).filter(Boolean)
    );
    for (const userEmail of memberEmails) {
      userRows.push({
        externalGroupId,
        stale: false,
        tenantId: input.tenantId,
        userEmail,
      });
    }
    if (group.grantsPublicAccess) {
      publicRows.push({
        externalGroupId,
        stale: false,
        tenantId: input.tenantId,
      });
    }
  }

  const dedupedUserRows = [
    ...new Map(
      userRows.map((row) => [
        `${row.tenantId}:${row.userEmail}:${row.externalGroupId}`,
        row,
      ])
    ).values(),
  ];
  const dedupedPublicRows = [
    ...new Map(
      publicRows.map((row) => [`${row.tenantId}:${row.externalGroupId}`, row])
    ).values(),
  ];

  for (
    let offset = 0;
    offset < dedupedUserRows.length;
    offset += UPSERT_BATCH_SIZE
  ) {
    const chunk = dedupedUserRows.slice(offset, offset + UPSERT_BATCH_SIZE);
    await db
      .insert(tenantDriveUserExternalGroups)
      .values(chunk)
      .onConflictDoUpdate({
        set: { stale: false, updatedAt: new Date() },
        target: [
          tenantDriveUserExternalGroups.tenantId,
          tenantDriveUserExternalGroups.userEmail,
          tenantDriveUserExternalGroups.externalGroupId,
        ],
      });
  }

  for (
    let offset = 0;
    offset < dedupedPublicRows.length;
    offset += UPSERT_BATCH_SIZE
  ) {
    const chunk = dedupedPublicRows.slice(offset, offset + UPSERT_BATCH_SIZE);
    await db
      .insert(tenantDrivePublicExternalGroups)
      .values(chunk)
      .onConflictDoUpdate({
        set: { stale: false, updatedAt: new Date() },
        target: [
          tenantDrivePublicExternalGroups.tenantId,
          tenantDrivePublicExternalGroups.externalGroupId,
        ],
      });
  }
}

export async function fetchTenantDriveExternalGroupIdsForUser(input: {
  tenantId: string;
  userEmail: string;
}) {
  const rows = await db
    .select({
      externalGroupId: tenantDriveUserExternalGroups.externalGroupId,
    })
    .from(tenantDriveUserExternalGroups)
    .where(
      and(
        eq(tenantDriveUserExternalGroups.tenantId, input.tenantId),
        eq(
          tenantDriveUserExternalGroups.userEmail,
          normalizeEmail(input.userEmail)
        ),
        eq(tenantDriveUserExternalGroups.stale, false)
      )
    );
  return rows.map((row) => row.externalGroupId);
}

export async function fetchTenantDrivePublicExternalGroupIds(tenantId: string) {
  const rows = await db
    .select({
      externalGroupId: tenantDrivePublicExternalGroups.externalGroupId,
    })
    .from(tenantDrivePublicExternalGroups)
    .where(
      and(
        eq(tenantDrivePublicExternalGroups.tenantId, tenantId),
        eq(tenantDrivePublicExternalGroups.stale, false)
      )
    );
  return rows.map((row) => row.externalGroupId);
}

export async function tenantDriveMembershipRowCount(tenantId: string) {
  const userRows = await db
    .select({ externalGroupId: tenantDriveUserExternalGroups.externalGroupId })
    .from(tenantDriveUserExternalGroups)
    .where(
      and(
        eq(tenantDriveUserExternalGroups.tenantId, tenantId),
        eq(tenantDriveUserExternalGroups.stale, false)
      )
    );
  return userRows.length;
}
