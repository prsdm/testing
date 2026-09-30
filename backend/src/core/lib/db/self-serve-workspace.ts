import { and, asc, eq } from "drizzle-orm";
import { ChatbotError } from "@/shared/errors";
import { generateUUID } from "@/shared/utils";
import { getDb } from "./client";
import {
  type Tenant,
  tenantAdminContacts,
  tenantDomains,
  tenantGeneralSettings,
  tenantMembers,
  tenantSearchSettings,
  tenants,
} from "./tables";

const db = getDb();

function slugifyWorkspace(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

async function allocateUniqueSlug(base: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = attempt === 0 ? "" : `-${generateUUID().slice(0, 6)}`;
    const slug = `${base}${suffix}`.slice(0, 64);
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (!existing) {
      return slug;
    }
  }
  return `ws-${generateUUID().replaceAll("-", "").slice(0, 16)}`;
}

/** All active workspaces the user belongs to (oldest first). */
export async function listActiveTenantsForAuthUserId(
  authUserId: string
): Promise<Tenant[]> {
  try {
    const rows = await db
      .select({ tenant: tenants })
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

    return rows.map((row) => row.tenant);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to list tenants for auth user"
    );
  }
}

/** True if the user has any membership row (active or deactivated). */
export async function hasAnyTenantMembershipForAuthUserId(
  authUserId: string
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: tenantMembers.id })
      .from(tenantMembers)
      .where(eq(tenantMembers.authUserId, authUserId))
      .limit(1);
    return Boolean(row);
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to check tenant memberships"
    );
  }
}

/** Self-serve workspace this user owns (billing home), if any. */
export async function getOwnedTenantForAuthUserId(
  authUserId: string
): Promise<Tenant | null> {
  try {
    const [row] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.ownerAuthUserId, authUserId))
      .limit(1);
    return row ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to load owned workspace"
    );
  }
}

export async function getTenantForAuthUserId(
  authUserId: string,
  preferredTenantSlug?: string | null
): Promise<Tenant | null> {
  const memberships = await listActiveTenantsForAuthUserId(authUserId);
  if (memberships.length === 0) {
    return null;
  }

  if (preferredTenantSlug) {
    const preferred = memberships.find(
      (tenant) => tenant.slug === preferredTenantSlug
    );
    if (preferred) {
      return preferred;
    }
  }

  return memberships.at(0) ?? null;
}

/**
 * Create the user's single self-serve owned workspace.
 * No-ops (returns existing) if they already own one.
 */
export async function createSelfServeWorkspace({
  authUserId,
  email,
  displayName,
}: {
  authUserId: string;
  email: string;
  displayName?: string | null;
}): Promise<Tenant> {
  const existingOwned = await getOwnedTenantForAuthUserId(authUserId);
  if (existingOwned) {
    return existingOwned;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] || "workspace";
  const companyName = (displayName?.trim() || "Default").slice(0, 120);
  const slug = await allocateUniqueSlug(slugifyWorkspace(localPart));
  const primaryDomain = `ws-${slug}.kimiro.local`;
  const now = new Date();

  try {
    const [tenant] = await db
      .insert(tenants)
      .values({
        companyName,
        createdAt: now,
        ownerAuthUserId: authUserId,
        primaryDomain,
        slug,
        status: "active",
        updatedAt: now,
      })
      .returning();

    await db.insert(tenantDomains).values({
      createdAt: now,
      domain: primaryDomain,
      tenantId: tenant.id,
      verifiedAt: now,
    });

    await db.insert(tenantAdminContacts).values({
      createdAt: now,
      email: normalizedEmail,
      tenantId: tenant.id,
    });

    await db.insert(tenantMembers).values({
      authUserId,
      createdAt: now,
      email: normalizedEmail,
      id: generateUUID(),
      isActive: true,
      lastLoginAt: now,
      personId: null,
      role: "admin",
      tenantId: tenant.id,
      updatedAt: now,
    });

    await db
      .insert(tenantGeneralSettings)
      .values({ tenantId: tenant.id })
      .onConflictDoNothing({ target: tenantGeneralSettings.tenantId });
    await db
      .insert(tenantSearchSettings)
      .values({ tenantId: tenant.id })
      .onConflictDoNothing({ target: tenantSearchSettings.tenantId });

    return tenant;
  } catch (error) {
    // Concurrent create: unique owner index — return the winner's workspace.
    const raced = await getOwnedTenantForAuthUserId(authUserId);
    if (raced) {
      return raced;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to create self-serve workspace"
    );
  }
}
