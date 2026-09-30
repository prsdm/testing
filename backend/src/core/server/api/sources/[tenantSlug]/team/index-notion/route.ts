import { indexNotionBodySchema } from "@/core/lib/sources/index-notion-body-schema";
import { handleIndexNotionRequest } from "@/core/lib/sources/index-notion-route-handler";
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

  let body: ReturnType<typeof indexNotionBodySchema.parse>;
  try {
    body = indexNotionBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  return handleIndexNotionRequest({
    body,
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });
}
