import {
  getTenantAccessContextByEmail,
  getTenantBySlug,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";

/**
 * Resolve tenant by slug + membership (or email domain), then require an active
 * membership that also passes the shared OU / inactive-person access gate.
 * Used by connector OAuth/status.
 */
export async function resolveActiveTenantForUser(input: {
  tenantSlug: string;
  userEmail: string;
  authUserId: string;
}) {
  const [tenantForUser, tenant] = await Promise.all([
    resolveTenantForUser({
      authUserId: input.authUserId,
      email: input.userEmail,
      preferredTenantSlug: input.tenantSlug,
    }),
    getTenantBySlug(input.tenantSlug),
  ]);
  if (!tenant || !tenantForUser || tenantForUser.slug !== tenant.slug) {
    return null;
  }

  const [memberAllowed, accessContext] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: input.authUserId,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(input.userEmail),
  ]);
  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return null;
  }

  return tenant;
}
