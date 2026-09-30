import { and, eq, notLike } from "drizzle-orm";
import type { SourceConnectorType } from "@/core/lib/db/source-queries";
import { getDb } from "./client";
import { CONNECTOR_SPACE_GROUP_PREFIX } from "./connector-membership-ids";
import { tenantConnectorUserExternalGroups } from "./tables";

export {
  CONNECTOR_SPACE_GROUP_PREFIX,
  isConnectorSpaceGroupId,
} from "./connector-membership-ids";

const UPSERT_BATCH_SIZE = 5000;
const CONNECTOR_MEMBERSHIP_SOURCE_TYPES = new Set<SourceConnectorType>([
  "confluence",
  "sharepoint",
]);

const db = getDb();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeSourceType(sourceType: SourceConnectorType) {
  if (!CONNECTOR_MEMBERSHIP_SOURCE_TYPES.has(sourceType)) {
    throw new Error(
      `Unsupported connector membership source type: ${sourceType}`
    );
  }
  return sourceType;
}

type StaleScope = {
  tenantId: string;
  sourceType: SourceConnectorType;
  userEmail?: string;
  externalGroupId?: string;
  /** When true, leave space:{id} rows alone (group sync must not wipe them). */
  excludeSpaceGroups?: boolean;
};

function staleWhere(args: StaleScope) {
  const sourceType = normalizeSourceType(args.sourceType);
  const conditions = [
    eq(tenantConnectorUserExternalGroups.tenantId, args.tenantId),
    eq(tenantConnectorUserExternalGroups.sourceType, sourceType),
  ];
  if (args.userEmail) {
    conditions.push(
      eq(
        tenantConnectorUserExternalGroups.userEmail,
        normalizeEmail(args.userEmail)
      )
    );
  }
  if (args.externalGroupId) {
    conditions.push(
      eq(
        tenantConnectorUserExternalGroups.externalGroupId,
        args.externalGroupId.trim().toLowerCase()
      )
    );
  }
  if (args.excludeSpaceGroups) {
    conditions.push(
      notLike(
        tenantConnectorUserExternalGroups.externalGroupId,
        `${CONNECTOR_SPACE_GROUP_PREFIX}%`
      )
    );
  }
  return and(...conditions);
}

export async function markTenantConnectorExternalGroupsStale(args: StaleScope) {
  await db
    .update(tenantConnectorUserExternalGroups)
    .set({ stale: true })
    .where(staleWhere(args));
}

export async function removeStaleTenantConnectorExternalGroups(
  args: StaleScope
) {
  await db
    .delete(tenantConnectorUserExternalGroups)
    .where(
      and(staleWhere(args), eq(tenantConnectorUserExternalGroups.stale, true))
    );
}

export async function upsertTenantConnectorUserExternalGroupMemberships(input: {
  tenantId: string;
  sourceType: SourceConnectorType;
  userEmail: string;
  externalGroupIds: string[];
}) {
  const sourceType = normalizeSourceType(input.sourceType);
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
      .insert(tenantConnectorUserExternalGroups)
      .values(
        chunk.map((externalGroupId) => ({
          externalGroupId,
          sourceType,
          stale: false,
          tenantId: input.tenantId,
          userEmail,
        }))
      )
      .onConflictDoUpdate({
        set: { stale: false, updatedAt: new Date() },
        target: [
          tenantConnectorUserExternalGroups.tenantId,
          tenantConnectorUserExternalGroups.sourceType,
          tenantConnectorUserExternalGroups.userEmail,
          tenantConnectorUserExternalGroups.externalGroupId,
        ],
      });
  }
}

export async function fetchTenantConnectorExternalGroupIdsForUser(input: {
  tenantId: string;
  userEmail: string;
  sourceType?: SourceConnectorType;
}) {
  const conditions = [
    eq(tenantConnectorUserExternalGroups.tenantId, input.tenantId),
    eq(
      tenantConnectorUserExternalGroups.userEmail,
      normalizeEmail(input.userEmail)
    ),
    eq(tenantConnectorUserExternalGroups.stale, false),
  ];
  if (input.sourceType) {
    conditions.push(
      eq(
        tenantConnectorUserExternalGroups.sourceType,
        normalizeSourceType(input.sourceType)
      )
    );
  }

  const rows = await db
    .select({
      externalGroupId: tenantConnectorUserExternalGroups.externalGroupId,
      sourceType: tenantConnectorUserExternalGroups.sourceType,
    })
    .from(tenantConnectorUserExternalGroups)
    .where(and(...conditions));

  return rows.map((row) => ({
    externalGroupId: row.externalGroupId,
    sourceType: row.sourceType as SourceConnectorType,
  }));
}

export function listTenantConnectorExternalGroupMembershipRows(args: {
  tenantId: string;
}) {
  return db
    .select({
      externalGroupId: tenantConnectorUserExternalGroups.externalGroupId,
      sourceType: tenantConnectorUserExternalGroups.sourceType,
      userEmail: tenantConnectorUserExternalGroups.userEmail,
    })
    .from(tenantConnectorUserExternalGroups)
    .where(
      and(
        eq(tenantConnectorUserExternalGroups.tenantId, args.tenantId),
        eq(tenantConnectorUserExternalGroups.stale, false)
      )
    );
}
