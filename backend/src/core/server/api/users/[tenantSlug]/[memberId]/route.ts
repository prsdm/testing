import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { invalidateAuthSessionsForUser } from "@/core/lib/auth/invalidate-sessions";
import { setMemberCustomRoles } from "@/core/lib/db/custom-role-queries";
import {
  clearTenantAccessContextCacheForEmail,
  getTenantMemberById,
  insertSecurityAuditEvent,
  updateTenantMember,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";
import { TENANT_MEMBER_ROLES } from "@/shared/users/tenant-member-role";

const updateMemberBodySchema = z
  .object({
    customRoleIds: z.array(z.string().uuid()).max(1).optional(),
    isActive: z.boolean().optional(),
    role: z.enum(TENANT_MEMBER_ROLES).optional(),
  })
  .refine(
    (body) =>
      body.role !== undefined ||
      body.isActive !== undefined ||
      body.customRoleIds !== undefined,
    "At least one field is required"
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; memberId: string }> }
) {
  const { tenantSlug, memberId } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `users:${tenantSlug}:${memberId}`,
    "admin.users"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof updateMemberBodySchema>;
  try {
    body = updateMemberBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await getTenantMemberById({
    memberId,
    tenantId: authResult.tenant.id,
  });
  if (!existing) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (
    (body.isActive === false || body.role !== undefined) &&
    existing.authUserId === authResult.userId
  ) {
    if (body.isActive === false) {
      return Response.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }
    if (body.role !== undefined && body.role !== existing.role) {
      return Response.json(
        { error: "You cannot change your own role." },
        { status: 400 }
      );
    }
  }

  // Promoting/demoting built-in Admin requires full Admin.
  if (
    body.role !== undefined &&
    body.role !== existing.role &&
    !authResult.isFullAdmin
  ) {
    return Response.json(
      { error: "Only full Admins can change Admin/Basic." },
      { status: 403 }
    );
  }

  let updated = existing;

  if (body.role !== undefined || body.isActive !== undefined) {
    try {
      const next = await updateTenantMember({
        isActive: body.isActive,
        memberId,
        role: body.role,
        tenantId: authResult.tenant.id,
      });
      if (!next) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      updated = next;
    } catch (error) {
      const message =
        error instanceof ChatbotError &&
        typeof error.cause === "string" &&
        error.cause
          ? error.cause
          : error instanceof Error
            ? error.message
            : "Failed to update member";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  let customRoleIds: string[] | undefined;
  if (body.customRoleIds !== undefined || body.role === "admin") {
    customRoleIds = await setMemberCustomRoles({
      memberId,
      roleIds: body.role === "admin" ? [] : (body.customRoleIds ?? []),
      tenantId: authResult.tenant.id,
    });
  }

  if (body.isActive === false) {
    clearTenantAccessContextCacheForEmail(updated.email);
    if (updated.authUserId) {
      await invalidateAuthSessionsForUser(updated.authUserId);
    }
  }

  await insertSecurityAuditEvent({
    action: "tenant.member.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    metadata: {
      customRoleIds: customRoleIds ?? null,
      isActive: body.isActive ?? null,
      role: body.role ?? null,
    },
    resource: `users:${tenantSlug}:${memberId}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({
    member: {
      customRoleIds: customRoleIds ?? undefined,
      email: updated.email,
      id: updated.id,
      isActive: updated.isActive,
      role: updated.role,
    },
    ok: true,
  });
}
