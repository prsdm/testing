import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

/**
 * Re-validate returnTo from the OAuth state cookie (defense in depth).
 */
export function sanitizeOAuthCallbackReturnTo(
  returnTo: string | null | undefined,
  tenantSlug: string
): string {
  return safeAppReturnTo(returnTo, tenantSlug);
}

/**
 * Ensure the browser session still matches the user who started OAuth.
 * Cookie state alone must not authorize connector writes.
 */
export async function assertOAuthCallbackSession(payload: {
  userId: string;
  userEmail: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, reason: "Not signed in." };
  }
  if (session.user.id !== payload.userId) {
    return { ok: false, reason: "Session does not match OAuth state." };
  }
  if (
    session.user.email.trim().toLowerCase() !==
    payload.userEmail.trim().toLowerCase()
  ) {
    return { ok: false, reason: "Session email does not match OAuth state." };
  }
  return { ok: true };
}

/**
 * Session match + active tenant membership for the signed OAuth workspace.
 * Prefer the returned tenant.id for credential writes.
 */
export async function assertOAuthCallbackAccess(payload: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}): Promise<
  | { ok: true; tenant: { id: string; slug: string } }
  | { ok: false; reason: string }
> {
  const sessionCheck = await assertOAuthCallbackSession(payload);
  if (!sessionCheck.ok) {
    return sessionCheck;
  }

  const tenant = await resolveActiveTenantForUser({
    authUserId: payload.userId,
    tenantSlug: payload.tenantSlug,
    userEmail: payload.userEmail,
  });
  if (!tenant) {
    return { ok: false, reason: "Not allowed for this workspace." };
  }
  if (tenant.id !== payload.tenantId || tenant.slug !== payload.tenantSlug) {
    return { ok: false, reason: "OAuth workspace mismatch." };
  }

  return { ok: true, tenant: { id: tenant.id, slug: tenant.slug } };
}
