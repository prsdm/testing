import { resolveCapabilitiesForEmail } from "@/core/lib/db/custom-role-queries";
import {
  getTenantAccessContextByEmail,
  getTenantBySlug,
  isTenantAdminEmail,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import {
  getClientIpFromHeaders,
  requireSensitiveSession,
} from "@/core/lib/security/sensitive-session";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";
import {
  type CapabilityId,
  hasAnyAdminCapability,
  hasCapability,
} from "@/shared/auth/capabilities";

export type TenantCapabilityAuth = {
  tenant: Awaited<ReturnType<typeof getTenantBySlug>> & object;
  userEmail: string;
  userId: string;
  request: Request;
  ipAddress: string | null;
  capabilities: Set<CapabilityId>;
  isFullAdmin: boolean;
};

async function assertTenantRequestBase(
  tenantSlug: string,
  request: Request,
  resource: string
) {
  const sensitive = await requireSensitiveSession(request, { resource });
  if (!sensitive.ok) {
    return { error: sensitive.response } as const;
  }

  const userEmail = sensitive.user.email;
  if (!userEmail) {
    return {
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const [tenantForUser, tenant] = await Promise.all([
    resolveTenantForUser({
      authUserId: sensitive.user.id,
      email: userEmail,
      preferredTenantSlug: tenantSlug,
    }),
    getTenantBySlug(tenantSlug),
  ]);
  if (!tenant || !tenantForUser || tenantForUser.slug !== tenant.slug) {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  const [memberAllowed, accessContext] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: sensitive.user.id,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(userEmail),
  ]);

  if (!memberAllowed || accessContext?.personStatus === "inactive") {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  const [isFullAdmin, capabilities] = await Promise.all([
    isTenantAdminEmail({
      email: userEmail,
      tenantId: tenant.id,
    }),
    resolveCapabilitiesForEmail({
      email: userEmail,
      tenantId: tenant.id,
    }),
  ]);

  return {
    capabilities,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    isFullAdmin,
    request,
    tenant,
    userEmail,
    userId: sensitive.user.id,
  } as const;
}

/** Full Admin only (built-in admin role / admin contacts). */
export async function assertTenantAdminRequest(
  tenantSlug: string,
  request: Request,
  resource: string
) {
  const result = await assertTenantRequestBase(tenantSlug, request, resource);
  if ("error" in result) {
    return result;
  }

  if (!result.isFullAdmin) {
    return {
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    } as const;
  }

  return result;
}

/** Any admin-console capability (full admin or custom role). */
export async function assertTenantAdminConsoleRequest(
  tenantSlug: string,
  request: Request,
  resource: string
) {
  const result = await assertTenantRequestBase(tenantSlug, request, resource);
  if ("error" in result) {
    return result;
  }

  if (!result.isFullAdmin && !hasAnyAdminCapability(result.capabilities)) {
    return {
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    } as const;
  }

  return result;
}

/** Specific capability required. */
export async function assertTenantCapabilityRequest(
  tenantSlug: string,
  request: Request,
  resource: string,
  capability: CapabilityId
) {
  const result = await assertTenantRequestBase(tenantSlug, request, resource);
  if ("error" in result) {
    return result;
  }

  if (!hasCapability(result.capabilities, capability)) {
    return {
      error: Response.json(
        { error: "You do not have permission for this action." },
        { status: 403 }
      ),
    } as const;
  }

  return result;
}
