import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  deleteTenantPeopleGroup,
  getTenantPeopleGroupDetail,
  updateTenantPeopleGroup,
} from "@/core/lib/db/people-group-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; groupId: string }> }
) {
  const { tenantSlug, groupId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:groups:${groupId}`,
    "admin.groups"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const group = await getTenantPeopleGroupDetail({
    groupId,
    tenantId: authResult.tenant.id,
  });

  if (!group) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  return Response.json(group);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; groupId: string }> }
) {
  const { tenantSlug, groupId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:groups:${groupId}`,
    "admin.groups"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updated = await updateTenantPeopleGroup({
    groupId,
    name: body.name,
    tenantId: authResult.tenant.id,
  });

  if (!updated) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.groups.update",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: { name: updated.name },
    resource: `group:${groupId}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const group = await getTenantPeopleGroupDetail({
    groupId,
    tenantId: authResult.tenant.id,
  });

  return Response.json(group);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; groupId: string }> }
) {
  const { tenantSlug, groupId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:groups:${groupId}`,
    "admin.groups"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const deleted = await deleteTenantPeopleGroup({
    groupId,
    tenantId: authResult.tenant.id,
  });

  if (!deleted) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.groups.delete",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `group:${groupId}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({ success: true });
}
