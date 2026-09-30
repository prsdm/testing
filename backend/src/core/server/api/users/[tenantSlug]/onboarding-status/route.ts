import { getMemberProfileOnboardingStatus } from "@/core/lib/db/user-profile-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const status = await getMemberProfileOnboardingStatus({
    authUserId: authResult.userId,
    tenantId: authResult.tenant.id,
  });

  if (!status) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  return Response.json(status);
}
