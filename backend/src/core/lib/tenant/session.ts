import { auth } from "@/core/lib/auth/server-session";
import { throwApiRedirect } from "@/core/lib/http/redirect";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";

export async function getTenantForSession() {
  const session = await auth();

  if (!session?.user?.email || !session.user.id) {
    throwApiRedirect("/login");
  }

  const tenant = await resolveTenantForUser({
    authUserId: session.user.id,
    email: session.user.email,
  });
  if (!tenant) {
    throwApiRedirect("/login");
  }

  return { session, tenant };
}
