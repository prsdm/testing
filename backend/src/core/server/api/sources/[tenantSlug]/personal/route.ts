import { z } from "zod";
import {
  createTeamKbItem,
  deleteTeamKbItem,
} from "@/core/lib/db/source-queries";
import {
  getPaginatedVisibleKbItems,
  parseKbListPageParams,
} from "@/core/lib/sources/source-list-api";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const createSchema = z.object({
  content: z.string().max(100_000).optional(),
  externalRef: z.string().max(1024).nullable().optional(),
  link: z.string().max(2048).nullable().optional(),
  sourceType: z
    .enum(["manual", "drive", "upload", "confluence", "notion", "sharepoint"])
    .optional(),
  title: z.string().min(1).max(512),
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

  const { page, limit } = parseKbListPageParams(
    new URL(request.url).searchParams
  );
  const result = await getPaginatedVisibleKbItems({
    limit,
    page,
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });

  return Response.json(result);
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

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const item = await createTeamKbItem({
    createdByUserId: authResult.userId,
    input: body,
    tenantId: authResult.tenant.id,
  });

  return Response.json({ item }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const itemId = new URL(request.url).searchParams.get("id")?.trim();
  if (!itemId) {
    return Response.json(
      { error: "Missing id query parameter" },
      { status: 400 }
    );
  }

  const deleted = await deleteTeamKbItem({
    createdByUserId: authResult.userId,
    itemId,
    tenantId: authResult.tenant.id,
  });

  if (!deleted) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
