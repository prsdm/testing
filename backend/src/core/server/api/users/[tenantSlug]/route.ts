import { auth } from "@/core/lib/auth/server-session";
import {
  getTenantBySlug,
  getTenantMembersBySlug,
  isTenantAdminEmail,
} from "@/core/lib/db/queries";
import { resolveTenantForUser } from "@/core/lib/tenant/resolve-tenant-for-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !session.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tenantSlug } = await params;

  const [tenantForUser, tenant] = await Promise.all([
    resolveTenantForUser({
      authUserId: session.user.id,
      email: session.user.email,
      preferredTenantSlug: tenantSlug,
    }),
    getTenantBySlug(tenantSlug),
  ]);
  if (!tenant || !tenantForUser || tenantForUser.slug !== tenant.slug) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const isAdmin = await isTenantAdminEmail({
    email: session.user.email,
    tenantId: tenant.id,
  });
  if (!isAdmin) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const members = await getTenantMembersBySlug(tenantSlug);
  return Response.json({
    members: members.map((member) => ({
      authUserId: member.authUserId,
      createdAt: member.createdAt,
      department:
        member.memberDepartment?.trim() ||
        member.personDepartment?.trim() ||
        null,
      displayName:
        member.userName?.trim() ||
        member.displayName?.trim() ||
        `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
        null,
      email: member.email,
      id: member.id,
      inDirectory: Boolean(member.personId),
      isActive: member.isActive,
      jobTitle: member.jobTitle?.trim() || member.personTitle?.trim() || null,
      lastLoginAt: member.lastLoginAt,
      role: member.role,
    })),
  });
}
