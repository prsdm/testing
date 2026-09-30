import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  createTenantPeopleGroup,
  listTenantPeopleGroups,
} from "@/core/lib/db/people-group-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const postSchema = z.object({
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
    `admin:${tenantSlug}:groups`,
    "admin.groups"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const groups = await listTenantPeopleGroups(authResult.tenant.id);
  return Response.json({
    groups: groups.map((group) => ({
      createdAt: group.createdAt.toISOString(),
      id: group.id,
      memberCount: group.memberCount,
      name: group.name,
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
    `admin:${tenantSlug}:groups`,
    "admin.groups"
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

  const created = await createTenantPeopleGroup({
    name: body.name,
    tenantId: authResult.tenant.id,
  });

  if (!created) {
    return Response.json({ error: "Failed to create group." }, { status: 500 });
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.groups.create",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: { name: created.name },
    resource: `group:${created.id}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({
    createdAt: created.createdAt.toISOString(),
    id: created.id,
    memberCount: 0,
    name: created.name,
  });
}
