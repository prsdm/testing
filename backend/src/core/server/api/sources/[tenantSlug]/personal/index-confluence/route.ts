import { z } from "zod";
import { indexConfluencePagesToKb } from "@/core/lib/sources/index-confluence-pages";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const bodySchema = z.object({
  pageIds: z.array(z.string().min(1).max(128)).min(1).max(10),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await indexConfluencePagesToKb({
    pageIds: body.pageIds,
    tenantId: authResult.tenant.id,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, results: result.results },
      { status: 400 }
    );
  }

  return Response.json({ results: result.results });
}
