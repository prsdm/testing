import {
  getTenantMembersBySlug,
  isTenantAdminEmail,
} from "@/core/lib/db/queries";
import { toNotionShareMemberOptions } from "@/core/lib/sources/notion-share-member-options";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function loadSourcesPageBootstrap(
  tenantSlug: string,
  request: Request
) {
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return { error: authResult.error } as const;
  }

  const { tenant, userEmail, userId } = authResult;

  const [members, canPublishToWorkspace] = await Promise.all([
    getTenantMembersBySlug(tenant.slug),
    isTenantAdminEmail({
      email: userEmail,
      tenantId: tenant.id,
    }),
  ]);

  return {
    canPublishToWorkspace,
    notionShareMembers: toNotionShareMemberOptions(members),
    tenantSlug: tenant.slug,
    viewerEmail: userEmail,
    viewerUserId: userId,
  };
}
