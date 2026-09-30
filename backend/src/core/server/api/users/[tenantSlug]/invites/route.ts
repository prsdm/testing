import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  createTenantInvite,
  listPendingTenantInvites,
  revokeTenantInvite,
} from "@/core/lib/db/tenant-invite-queries";
import { ChatbotError } from "@/shared/errors";

const MAX_INVITES_PER_REQUEST = 50;

const createBodySchema = z.object({
  emails: z.array(z.string().email()).min(1).max(MAX_INVITES_PER_REQUEST),
  role: z.enum(["admin", "basic"]).default("basic"),
});

function inviteErrorMessage(error: unknown) {
  if (error instanceof ChatbotError) {
    return typeof error.cause === "string" && error.cause
      ? error.cause
      : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to create invite";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `users:${tenantSlug}:invites`,
    "admin.users"
  );
  if ("error" in authz) {
    return authz.error;
  }

  const invites = await listPendingTenantInvites(authz.tenant.id);
  return Response.json({
    invites: invites.map((invite) => ({
      createdAt: invite.createdAt.toISOString(),
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      id: invite.id,
      role: invite.role,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `users:${tenantSlug}:invites`,
    "admin.users"
  );
  if ("error" in authz) {
    return authz.error;
  }

  let body: z.infer<typeof createBodySchema>;
  try {
    body = createBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const uniqueEmails = [
    ...new Set(body.emails.map((email) => email.toLowerCase())),
  ];
  const invited: Array<{
    id: string;
    email: string;
    role: "admin" | "basic";
    expiresAt: string;
    createdAt: string;
  }> = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const email of uniqueEmails) {
    try {
      const { invite } = await createTenantInvite({
        companyName: authz.tenant.companyName,
        email,
        invitedByAuthUserId: authz.userId,
        role: body.role,
        tenantId: authz.tenant.id,
        tenantSlug: authz.tenant.slug,
      });
      invited.push({
        createdAt: invite.createdAt.toISOString(),
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
        id: invite.id,
        role: invite.role,
      });
    } catch (error) {
      failed.push({
        email,
        error: inviteErrorMessage(error),
      });
    }
  }

  if (invited.length === 0) {
    return Response.json(
      {
        error: failed.at(0)?.error ?? "Failed to create invites",
        failed,
        invited,
      },
      { status: 400 }
    );
  }

  return Response.json({ failed, invited });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `users:${tenantSlug}:invites`,
    "admin.users"
  );
  if ("error" in authz) {
    return authz.error;
  }

  const url = new URL(request.url);
  const inviteId = url.searchParams.get("inviteId")?.trim();
  if (!inviteId) {
    return Response.json({ error: "inviteId is required" }, { status: 400 });
  }

  const revoked = await revokeTenantInvite({
    inviteId,
    tenantId: authz.tenant.id,
  });
  if (!revoked) {
    return Response.json({ error: "Invite not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
