import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  addTenantPeopleGroupMembers,
  getTenantPeopleGroupDetail,
  removeTenantPeopleGroupMember,
} from "@/core/lib/db/people-group-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const postSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

const deleteSchema = z.object({
  personId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; groupId: string }> }
) {
  const { tenantSlug, groupId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:groups:${groupId}:members`,
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

  await addTenantPeopleGroupMembers({
    groupId,
    memberIds: body.memberIds,
    tenantId: authResult.tenant.id,
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.groups.members.add",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: { memberIds: body.memberIds },
    resource: `group:${groupId}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const group = await getTenantPeopleGroupDetail({
    groupId,
    tenantId: authResult.tenant.id,
  });

  if (!group) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

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
    `admin:${tenantSlug}:groups:${groupId}:members`,
    "admin.groups"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const removed = await removeTenantPeopleGroupMember({
    groupId,
    personId: body.personId,
    tenantId: authResult.tenant.id,
  });

  if (!removed) {
    return Response.json(
      { error: "Member not found in group." },
      { status: 404 }
    );
  }

  await insertSecurityAuditEvent({
    action: "tenant.admin.groups.members.remove",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: { personId: body.personId },
    resource: `group:${groupId}`,
    tenantId: authResult.tenant.id,
    userAgent: authResult.request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const group = await getTenantPeopleGroupDetail({
    groupId,
    tenantId: authResult.tenant.id,
  });

  if (!group) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  return Response.json(group);
}
