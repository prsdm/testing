import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  createTenantCustomRole,
  listTenantCustomRoles,
} from "@/core/lib/db/custom-role-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { CAPABILITY_IDS } from "@/shared/auth/capabilities";

const postSchema = z.object({
  capabilityIds: z.array(z.enum(CAPABILITY_IDS)).default([]),
  description: z.string().trim().max(2000).nullable().optional(),
  name: z.string().trim().min(1).max(255),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:roles`,
    "admin.roles"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const roles = await listTenantCustomRoles(authResult.tenant.id);
  return Response.json({
    roles: roles.map((role) => ({
      capabilityIds: role.capabilityIds,
      createdAt: role.createdAt.toISOString(),
      description: role.description,
      id: role.id,
      memberCount: role.memberCount,
      name: role.name,
      updatedAt: role.updatedAt.toISOString(),
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:roles`,
    "admin.roles"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const created = await createTenantCustomRole({
    capabilityIds: body.capabilityIds,
    description: body.description,
    name: body.name,
    tenantId: authResult.tenant.id,
  });

  if (!created) {
    return Response.json({ error: "Failed to create role." }, { status: 500 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.roles.create",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: {
      capabilityIds: created.capabilityIds,
      name: created.name,
    },
    resource: `role:${created.id}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({
    capabilityIds: created.capabilityIds,
    createdAt: created.createdAt.toISOString(),
    description: created.description,
    id: created.id,
    memberCount: 0,
    name: created.name,
    updatedAt: created.updatedAt.toISOString(),
  });
}
