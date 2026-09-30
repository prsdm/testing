import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  deleteTenantCustomRole,
  getTenantCustomRoleDetail,
  updateTenantCustomRole,
} from "@/core/lib/db/custom-role-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { CAPABILITY_IDS } from "@/shared/auth/capabilities";

const patchSchema = z.object({
  capabilityIds: z.array(z.enum(CAPABILITY_IDS)).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  name: z.string().trim().min(1).max(255).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; roleId: string }> }
) {
  const { tenantSlug, roleId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:roles:${roleId}`,
    "admin.roles"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const role = await getTenantCustomRoleDetail({
    roleId,
    tenantId: authResult.tenant.id,
  });

  if (!role) {
    return Response.json({ error: "Role not found." }, { status: 404 });
  }

  return Response.json({
    capabilityIds: role.capabilityIds,
    createdAt: role.createdAt.toISOString(),
    description: role.description,
    id: role.id,
    name: role.name,
    updatedAt: role.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; roleId: string }> }
) {
  const { tenantSlug, roleId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:roles:${roleId}`,
    "admin.roles"
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

  const updated = await updateTenantCustomRole({
    capabilityIds: body.capabilityIds,
    description: body.description,
    name: body.name,
    roleId,
    tenantId: authResult.tenant.id,
  });

  if (!updated) {
    return Response.json({ error: "Role not found." }, { status: 404 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.roles.update",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: {
      capabilityIds: updated.capabilityIds,
      name: updated.name,
    },
    resource: `role:${updated.id}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({
    capabilityIds: updated.capabilityIds,
    createdAt: updated.createdAt.toISOString(),
    description: updated.description,
    id: updated.id,
    name: updated.name,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; roleId: string }> }
) {
  const { tenantSlug, roleId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:roles:${roleId}`,
    "admin.roles"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const deleted = await deleteTenantCustomRole({
    roleId,
    tenantId: authResult.tenant.id,
  });

  if (!deleted) {
    return Response.json({ error: "Role not found." }, { status: 404 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.roles.delete",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `role:${roleId}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({ ok: true });
}
