import { autoIndexModifiedDriveKnowledgeForUser } from "@/core/lib/sources/drive-auto-index";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const driveIndex = await autoIndexModifiedDriveKnowledgeForUser({
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });

  return Response.json({
    result: driveIndex,
  });
}
