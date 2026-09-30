import { auth } from "@/core/lib/auth/server-session";
import { resolveActiveTenantForUser } from "@/core/lib/connectors/resolve-active-tenant-for-user";

export function resolveTenantForUser(input: {
  tenantSlug: string;
  userEmail: string;
  authUserId: string;
}) {
  return resolveActiveTenantForUser(input);
}

export async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }
  return session.user;
}
