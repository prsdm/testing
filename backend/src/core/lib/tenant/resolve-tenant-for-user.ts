import { getTenantByDomain } from "@/core/lib/db/queries";
import { listActiveTenantsForAuthUserId } from "@/core/lib/db/self-serve-workspace";
import type { Tenant } from "@/core/lib/db/tables";
import { requestCookies } from "@/core/lib/http/request-context";
import { ACTIVE_TENANT_COOKIE } from "@/core/lib/tenant/active-tenant";

function readPreferredTenantSlug(
  preferredTenantSlug?: string | null
): string | null {
  if (preferredTenantSlug) {
    return preferredTenantSlug;
  }
  try {
    const jar = requestCookies();
    return jar.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Prefer active-workspace cookie / explicit slug, then membership,
 * then email-domain tenant (enterprise SSO before membership exists).
 */
export async function resolveTenantForUser({
  authUserId,
  email,
  preferredTenantSlug,
}: {
  authUserId: string;
  email: string;
  preferredTenantSlug?: string | null;
}): Promise<Tenant | null> {
  const preferred = readPreferredTenantSlug(preferredTenantSlug);
  const memberships = await listActiveTenantsForAuthUserId(authUserId);

  if (preferred) {
    const match = memberships.find((tenant) => tenant.slug === preferred);
    if (match) {
      return match;
    }
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && memberships.length > 0) {
    const byDomain = await getTenantByDomain(domain);
    if (byDomain && memberships.some((tenant) => tenant.id === byDomain.id)) {
      return byDomain;
    }
  }

  if (memberships.length > 0) {
    return memberships.at(0) ?? null;
  }

  // No membership yet — enterprise domain join path / pre-provision.
  if (!domain) {
    return null;
  }
  return getTenantByDomain(domain);
}
