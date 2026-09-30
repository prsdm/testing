import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { listSecurityAuditEvents } from "@/core/lib/db/security-admin-queries";
import { auditActionPrefixForCategory } from "@/shared/admin/audit-event-categories";

function parseFilterDate(
  value: string | null,
  boundary: "start" | "end"
): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return boundary === "start"
      ? new Date(`${trimmed}T00:00:00.000Z`)
      : new Date(`${trimmed}T23:59:59.999Z`);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:audit-events`,
    "admin.audit"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 25), 1),
    100
  );
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const from = parseFilterDate(url.searchParams.get("from"), "start");
  const to = parseFilterDate(url.searchParams.get("to"), "end");

  const { events, total } = await listSecurityAuditEvents({
    actionPrefix: auditActionPrefixForCategory(category),
    from,
    limit,
    offset,
    query: query || undefined,
    tenantId: auth.tenant.id,
    to,
  });

  return Response.json({ events, limit, offset, total });
}
