import { z } from "zod";
import {
  createKnowledgeBase,
  listKnowledgeBasesForUser,
} from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const createKnowledgeBaseSchema = z.object({
  description: z.string().trim().max(2000).optional(),
  name: z.string().trim().min(1).max(512),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const knowledgeBases = await listKnowledgeBasesForUser({
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });

  return Response.json({ knowledgeBases });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
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

  const parsed = createKnowledgeBaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid knowledge base payload" },
      { status: 400 }
    );
  }

  try {
    const knowledgeBase = await createKnowledgeBase({
      createdByUserId: authResult.userId,
      description: parsed.data.description ?? null,
      name: parsed.data.name,
      tenantId: authResult.tenant.id,
    });

    return Response.json({ knowledgeBase }, { status: 201 });
  } catch (error) {
    console.error("Failed to create knowledge base:", error);
    return Response.json(
      { error: "Failed to create knowledge base. Please try again." },
      { status: 500 }
    );
  }
}
