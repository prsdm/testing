import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  getTenantAccessContextByEmail,
  isTenantMemberAccessAllowed,
  withTenantId,
} from "@/core/lib/db/queries";
import {
  tenantMembers,
  tenantPeople,
  tenantSsoConfigs,
  tenants,
} from "@/core/lib/db/tables";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";

const db = getDb();

/**
 * Block deactivated members / inactive people / OU mismatches from chat APIs.
 * Requires a resolvable tenant (membership or domain).
 */
export async function assertChatApiAccess(args: {
  userId: string;
  userEmail: string;
}): Promise<"ok" | "forbidden"> {
  const accessContext = await getTenantAccessContextByEmail(args.userEmail);
  if (!accessContext?.tenantId) {
    return "forbidden";
  }

  const memberAllowed = await isTenantMemberAccessAllowed({
    authUserId: args.userId,
    tenantId: accessContext.tenantId,
  });

  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext.allowedOrgUnits,
    memberAllowed,
    personOrgUnit: accessContext.personOrgUnit,
    personStatus: accessContext.personStatus,
  });
  return denial ? "forbidden" : "ok";
}

/** Tenant-scoped access check for headless triggers (e.g. Slack integration). */
export function assertChatApiAccessForTenant(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
}): Promise<"ok" | "forbidden"> {
  const normalizedEmail = args.userEmail.trim().toLowerCase();
  return withTenantId(args.tenantId, async () => {
    const [row] = await db
      .select({
        personLocation: tenantPeople.location,
        personStatus: tenantPeople.status,
        providerMetadata: tenantSsoConfigs.metadata,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .leftJoin(
        tenantPeople,
        and(
          eq(tenantPeople.tenantId, tenantMembers.tenantId),
          eq(tenantPeople.email, tenantMembers.email)
        )
      )
      .leftJoin(
        tenantSsoConfigs,
        and(
          eq(tenantSsoConfigs.tenantId, tenants.id),
          eq(tenantSsoConfigs.status, "active")
        )
      )
      .where(
        and(
          eq(tenantMembers.tenantId, args.tenantId),
          eq(tenantMembers.email, normalizedEmail),
          eq(tenantMembers.authUserId, args.userId),
          eq(tenantMembers.isActive, true),
          eq(tenants.status, "active")
        )
      )
      .limit(1);

    if (!row) {
      return "forbidden" as const;
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

    const memberAllowed = await isTenantMemberAccessAllowed({
      authUserId: args.userId,
      tenantId: args.tenantId,
    });
    const denial = evaluateTenantAccess({
      allowedOrgUnits,
      memberAllowed,
      personOrgUnit: row.personLocation?.trim().toLowerCase() ?? null,
      personStatus: row.personStatus,
    });
    return denial ? ("forbidden" as const) : ("ok" as const);
  });
}
