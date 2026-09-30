import { and, eq, inArray } from "drizzle-orm";
import { ChatbotError } from "@/shared/errors";
import type { IntegrationKey } from "@/shared/integrations/integration-catalog";
import { getDb } from "./client";
import {
  tenantIntegrationAvailability,
  tenantIntegrationMembers,
} from "./tables";

const db = getDb();

export type IntegrationAvailabilityMode = "everyone" | "selected";

export type IntegrationAvailabilityState = {
  isEnabled: boolean;
  availabilityMode: IntegrationAvailabilityMode;
  memberIds: string[];
};

export async function getIntegrationAvailability(
  tenantId: string,
  integrationKey: IntegrationKey
): Promise<IntegrationAvailabilityState> {
  const [row] = await db
    .select()
    .from(tenantIntegrationAvailability)
    .where(
      and(
        eq(tenantIntegrationAvailability.tenantId, tenantId),
        eq(tenantIntegrationAvailability.integrationKey, integrationKey)
      )
    )
    .limit(1);

  if (!row) {
    return {
      availabilityMode: "everyone",
      isEnabled: false,
      memberIds: [],
    };
  }

  const members =
    row.availabilityMode === "selected"
      ? await db
          .select({ memberId: tenantIntegrationMembers.memberId })
          .from(tenantIntegrationMembers)
          .where(
            and(
              eq(tenantIntegrationMembers.tenantId, tenantId),
              eq(tenantIntegrationMembers.integrationKey, integrationKey)
            )
          )
      : [];

  return {
    availabilityMode: row.availabilityMode,
    isEnabled: row.isEnabled,
    memberIds: members.map((member) => member.memberId),
  };
}

export async function listIntegrationAvailabilityForTenant(tenantId: string) {
  const rows = await db
    .select()
    .from(tenantIntegrationAvailability)
    .where(eq(tenantIntegrationAvailability.tenantId, tenantId));

  if (rows.length === 0) {
    return new Map<IntegrationKey, IntegrationAvailabilityState>();
  }

  const selectedKeys = rows
    .filter((row) => row.availabilityMode === "selected")
    .map((row) => row.integrationKey as IntegrationKey);

  const memberRows =
    selectedKeys.length === 0
      ? []
      : await db
          .select()
          .from(tenantIntegrationMembers)
          .where(
            and(
              eq(tenantIntegrationMembers.tenantId, tenantId),
              inArray(tenantIntegrationMembers.integrationKey, selectedKeys)
            )
          );

  const membersByKey = new Map<string, string[]>();
  for (const row of memberRows) {
    const existing = membersByKey.get(row.integrationKey) ?? [];
    existing.push(row.memberId);
    membersByKey.set(row.integrationKey, existing);
  }

  const result = new Map<IntegrationKey, IntegrationAvailabilityState>();
  for (const row of rows) {
    result.set(row.integrationKey as IntegrationKey, {
      availabilityMode: row.availabilityMode,
      isEnabled: row.isEnabled,
      memberIds: membersByKey.get(row.integrationKey) ?? [],
    });
  }
  return result;
}

export async function saveIntegrationAvailability(args: {
  tenantId: string;
  integrationKey: IntegrationKey;
  availabilityMode: IntegrationAvailabilityMode;
  memberIds: string[];
}) {
  if (args.availabilityMode === "selected" && args.memberIds.length === 0) {
    throw new ChatbotError(
      "bad_request:api",
      "Select at least one member or choose everyone."
    );
  }

  try {
    await db
      .insert(tenantIntegrationAvailability)
      .values({
        availabilityMode: args.availabilityMode,
        integrationKey: args.integrationKey,
        isEnabled: true,
        tenantId: args.tenantId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        set: {
          availabilityMode: args.availabilityMode,
          isEnabled: true,
          updatedAt: new Date(),
        },
        target: [
          tenantIntegrationAvailability.tenantId,
          tenantIntegrationAvailability.integrationKey,
        ],
      });

    await db
      .delete(tenantIntegrationMembers)
      .where(
        and(
          eq(tenantIntegrationMembers.tenantId, args.tenantId),
          eq(tenantIntegrationMembers.integrationKey, args.integrationKey)
        )
      );

    if (args.availabilityMode === "selected") {
      await db.insert(tenantIntegrationMembers).values(
        args.memberIds.map((memberId) => ({
          integrationKey: args.integrationKey,
          memberId,
          tenantId: args.tenantId,
        }))
      );
    }
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to save integration availability"
    );
  }
}

/** Turn the integration off and clear member allowlist (setup required again). */
export async function disableIntegrationAvailability(args: {
  tenantId: string;
  integrationKey: IntegrationKey;
}) {
  try {
    await db
      .insert(tenantIntegrationAvailability)
      .values({
        availabilityMode: "everyone",
        integrationKey: args.integrationKey,
        isEnabled: false,
        tenantId: args.tenantId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        set: {
          availabilityMode: "everyone",
          isEnabled: false,
          updatedAt: new Date(),
        },
        target: [
          tenantIntegrationAvailability.tenantId,
          tenantIntegrationAvailability.integrationKey,
        ],
      });

    await db
      .delete(tenantIntegrationMembers)
      .where(
        and(
          eq(tenantIntegrationMembers.tenantId, args.tenantId),
          eq(tenantIntegrationMembers.integrationKey, args.integrationKey)
        )
      );
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to disable integration availability"
    );
  }
}

export async function isIntegrationEnabledForMember(args: {
  tenantId: string;
  integrationKey: IntegrationKey;
  memberId: string;
}) {
  const state = await getIntegrationAvailability(
    args.tenantId,
    args.integrationKey
  );
  if (!state.isEnabled) {
    return false;
  }
  if (state.availabilityMode === "everyone") {
    return true;
  }
  return state.memberIds.includes(args.memberId);
}
