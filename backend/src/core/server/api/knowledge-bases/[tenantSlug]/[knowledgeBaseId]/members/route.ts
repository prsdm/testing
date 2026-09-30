import { z } from "zod";
import { getKnowledgeBaseAccess } from "@/core/lib/knowledge-bases/knowledge-base-access";
import {
  addKnowledgeBaseMember,
  listKnowledgeBaseMemberPickerOptions,
  listKnowledgeBaseMembers,
  removeKnowledgeBaseMember,
  updateKnowledgeBaseMemberRole,
} from "@/core/lib/knowledge-bases/knowledge-base-member-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";
import {
  canEditKnowledgeBase,
  canManageKnowledgeBaseMembers,
} from "@/shared/knowledge-bases/knowledge-base-access";

const memberRoleSchema = z.enum(["editor", "viewer"]);

const addMemberSchema = z.object({
  role: memberRoleSchema.default("viewer"),
  userId: z.string().trim().min(1),
});

const updateMemberSchema = z.object({
  role: memberRoleSchema,
  userId: z.string().trim().min(1),
});

function toErrorResponse(error: unknown) {
  if (error instanceof ChatbotError) {
    return error.toResponse();
  }
  return Response.json({ error: "Request failed" }, { status: 500 });
}

function serializeMember(member: {
  userId: string;
  role: "editor" | "viewer";
  email: string;
  displayName: string;
  image: string | null;
  createdAt: Date;
}) {
  return {
    createdAt: member.createdAt.toISOString(),
    displayName: member.displayName,
    email: member.email,
    image: member.image,
    role: member.role,
    userId: member.userId,
  };
}

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const access = await getKnowledgeBaseAccess({
      knowledgeBaseId,
      tenantId: authResult.tenant.id,
      userId: authResult.userId,
    });
    if (!access) {
      return Response.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    const members = await listKnowledgeBaseMembers({
      knowledgeBaseId,
      tenantId: authResult.tenant.id,
      userId: authResult.userId,
    });

    const pickerOptions = canManageKnowledgeBaseMembers(access.role)
      ? await listKnowledgeBaseMemberPickerOptions({
          knowledgeBaseId,
          ownerUserId: access.knowledgeBase.createdByUserId,
          tenantId: authResult.tenant.id,
          userId: authResult.userId,
        })
      : [];

    return Response.json({
      canEdit: canEditKnowledgeBase(access.role),
      canManageMembers: canManageKnowledgeBaseMembers(access.role),
      members: members.map(serializeMember),
      ownerUserId: access.knowledgeBase.createdByUserId,
      pickerOptions,
      viewerRole: access.role,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid member payload" }, { status: 400 });
  }

  try {
    const member = await addKnowledgeBaseMember({
      actorUserId: authResult.userId,
      knowledgeBaseId,
      memberUserId: parsed.data.userId,
      role: parsed.data.role,
      tenantId: authResult.tenant.id,
    });

    return Response.json(
      {
        member: {
          createdAt: member.createdAt.toISOString(),
          role: member.role,
          userId: member.userId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid member payload" }, { status: 400 });
  }

  try {
    const member = await updateKnowledgeBaseMemberRole({
      actorUserId: authResult.userId,
      knowledgeBaseId,
      memberUserId: parsed.data.userId,
      role: parsed.data.role,
      tenantId: authResult.tenant.id,
    });

    return Response.json({
      member: {
        role: member.role,
        userId: member.userId,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const memberUserId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!memberUserId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    await removeKnowledgeBaseMember({
      actorUserId: authResult.userId,
      knowledgeBaseId,
      memberUserId,
      tenantId: authResult.tenant.id,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
