import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { runTenantDriveIndexBySlug } from "@/core/lib/indexing/drive-orchestrator";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authz) {
    return authz.error;
  }
  const { tenant, userEmail, userId } = authz;

  try {
    const result = await runTenantDriveIndexBySlug(tenantSlug);
    await insertSecurityAuditEvent({
      action: "tenant.integrations.index.triggered",
      email: userEmail,
      ipAddress: getClientIpFromHeaders(request.headers) ?? null,
      metadata: {
        chunksIndexed: result.chunksIndexed,
        documentsIndexed: result.documentsIndexed,
        listedFiles: result.listedFiles,
        prunedStaleDocuments: result.prunedStaleDocuments,
        skippedFiles: result.skippedFiles,
        skippedSamples: result.skippedSamples,
        unchangedFiles: result.unchangedFiles,
      },
      resource: `integrations:${tenantSlug}:index`,
      tenantId: tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Failed to index Google Drive";
    return Response.json({ error: detail }, { status: 500 });
  }
}
