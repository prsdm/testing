import { loadAdminPageBootstrap } from "@/core/lib/admin/admin-page-bootstrap";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const result = await loadAdminPageBootstrap(tenantSlug, request);
  if ("error" in result) {
    return result.error;
  }

  return Response.json(result);
}
