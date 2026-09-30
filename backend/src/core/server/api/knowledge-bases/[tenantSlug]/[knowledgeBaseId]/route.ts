import { z } from "zod";
import { getKnowledgeBaseAccess } from "@/core/lib/knowledge-bases/knowledge-base-access";
import {
  deleteKnowledgeBase,
  listKnowledgeBaseSources,
  updateKnowledgeBase,
} from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";
import {
  canDeleteKnowledgeBase,
  canEditKnowledgeBase,
  canManageKnowledgeBaseMembers,
} from "@/shared/knowledge-bases/knowledge-base-access";

const updateKnowledgeBaseSchema = z
  .object({
    description: z.string().trim().max(2000).nullable().optional(),
    name: z.string().trim().min(1).max(512).optional(),
  })
  .refine((body) => body.name !== undefined || body.description !== undefined, {
    message: "At least one field is required",
  });

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

  const sources = await listKnowledgeBaseSources({ knowledgeBaseId });

  const isChannelKnowledgeBase = Boolean(access.knowledgeBase.channelChatId);

  return Response.json(
    {
      canDelete: !isChannelKnowledgeBase && canDeleteKnowledgeBase(access.role),
      canEdit: canEditKnowledgeBase(access.role),
      canManageMembers:
        !isChannelKnowledgeBase && canManageKnowledgeBaseMembers(access.role),
      knowledgeBase: access.knowledgeBase,
      sources,
      viewerRole: access.role,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
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

  const parsed = updateKnowledgeBaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid knowledge base payload" },
      { status: 400 }
    );
  }

  const updated = await updateKnowledgeBase({
    description: parsed.data.description,
    knowledgeBaseId,
    name: parsed.data.name,
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });

  return Response.json({ knowledgeBase: updated });
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

  try {
    await deleteKnowledgeBase({
      knowledgeBaseId,
      tenantId: authResult.tenant.id,
      userId: authResult.userId,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json(
      { error: "Failed to delete knowledge base" },
      { status: 500 }
    );
  }
}
