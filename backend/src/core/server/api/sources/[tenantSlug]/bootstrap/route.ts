import { loadSourcesPageBootstrap } from "@/core/lib/sources/sources-page-bootstrap";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const bootstrap = await loadSourcesPageBootstrap(tenantSlug, request);
  if ("error" in bootstrap) {
    return bootstrap.error;
  }

  return Response.json(bootstrap);
}
