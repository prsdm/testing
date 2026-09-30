import { auth } from "@/core/lib/auth/server-session";
import { getSessionIdleTimeoutMs } from "@/core/lib/auth/session-policy";
import { resolveCapabilitiesForEmail } from "@/core/lib/db/custom-role-queries";
import {
  getTenantAccessContextByEmail,
  isTenantAdminEmail,
  isTenantMemberAccessAllowed,
} from "@/core/lib/db/queries";
import { listActiveTenantsForAuthUserId } from "@/core/lib/db/self-serve-workspace";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";
import { hasAnyAdminCapability } from "@/shared/auth/capabilities";
import type { WorkspaceShellContext } from "@/shared/workspace/shell-context-types";

export type { WorkspaceShellContext } from "@/shared/workspace/shell-context-types";

export async function loadWorkspaceShellContext(options?: {
  sidebarOpen?: boolean;
}): Promise<WorkspaceShellContext> {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) {
    return { error: "Unauthorized", ok: false, status: 401 };
  }

  const activeMemberships = await listActiveTenantsForAuthUserId(
    session.user.id
  );
  if (activeMemberships.length === 0) {
    return { error: "no_workspace", ok: false, status: 403 };
  }

  const tenant = await resolveTenantForUser({
    authUserId: session.user.id,
    email: session.user.email,
  });
  if (!tenant) {
    return { error: "no_workspace", ok: false, status: 403 };
  }

  const [isFullAdmin, capabilities, memberAllowed, accessContext] =
    await Promise.all([
      isTenantAdminEmail({
        email: session.user.email,
        tenantId: tenant.id,
      }),
      resolveCapabilitiesForEmail({
        email: session.user.email,
        tenantId: tenant.id,
      }),
      isTenantMemberAccessAllowed({
        authUserId: session.user.id,
        tenantId: tenant.id,
      }),
      getTenantAccessContextByEmail(session.user.email),
    ]);

  const denial = evaluateTenantAccess({
    allowedOrgUnits: accessContext?.allowedOrgUnits ?? [],
    memberAllowed,
    personOrgUnit: accessContext?.personOrgUnit ?? null,
    personStatus: accessContext?.personStatus,
  });
  if (denial) {
    return { error: "access_denied", ok: false, status: 403 };
  }

  const capabilityList = [...capabilities];
  const showAdminEntry = isFullAdmin || hasAnyAdminCapability(capabilityList);

  return {
    capabilities: capabilityList,
    idleTimeoutMs: getSessionIdleTimeoutMs(),
    isAdmin: isFullAdmin,
    ok: true,
    showAdminEntry,
    sidebarOpen: options?.sidebarOpen ?? true,
    tenantSlug: tenant.slug,
    user: session.user,
  };
}
