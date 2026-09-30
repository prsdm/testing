import {
  getTenantAccessContextByEmail,
  getTenantBySlug,
  isTenantAdminEmail,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { requireSensitiveSession } from "@/core/lib/security/sensitive-session";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";

export async function assertTenantMember(tenantSlug: string, request: Request) {
  const sensitive = await requireSensitiveSession(request, {
    resource: `kb:${tenantSlug}`,
  });
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

  // Deactivated members and inactive people must not retain API access, matching
  // the gate enforced on the chat route and UI shell.
  const [memberAllowed, accessContext] = await Promise.all([
    isTenantMemberAccessAllowed({
      authUserId: sensitive.user.id,
      tenantId: tenant.id,
    }),
    getTenantAccessContextByEmail(userEmail),
  ]);
  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return {
      error: Response.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  return {
    tenant,
    userEmail,
    userId: sensitive.user.id,
  } as const;
}

export async function assertTenantAdmin(tenantSlug: string, request: Request) {
  const member = await assertTenantMember(tenantSlug, request);
  if ("error" in member) {
    return member;
  }

  const isAdmin = await isTenantAdminEmail({
    email: member.userEmail,
    tenantId: member.tenant.id,
  });
  if (!isAdmin) {
    return {
      error: Response.json({ error: "Admin access required" }, { status: 403 }),
    } as const;
  }

  return member;
}
