import { getLibraryCloudExportStatus } from "@/core/lib/library/cloud-export-status";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const returnTo =
    new URL(request.url).searchParams.get("returnTo")?.trim() || undefined;

  const status = await getLibraryCloudExportStatus({ returnTo, tenantSlug });
  if ("error" in status) {
    return Response.json({ error: status.error }, { status: status.status });
  }

  return Response.json(status);
}
