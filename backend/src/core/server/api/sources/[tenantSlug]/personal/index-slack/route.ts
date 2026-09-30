import { z } from "zod";
import { isTenantAdminEmail } from "@/core/lib/db/queries";
import {
  indexSlackChannelsToKb,
  removeSlackChannelsFromKb,
} from "@/core/lib/sources/index-slack-channels";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const bodySchema = z.object({
  channelIds: z.array(z.string().min(1).max(64)).min(1).max(10),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await indexSlackChannelsToKb({
    channelIds: body.channelIds,
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, results: result.results },
      { status: 400 }
    );
  }

  return Response.json({ results: result.results });
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

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const isAdmin = await isTenantAdminEmail({
    email: authResult.userEmail,
    tenantId: authResult.tenant.id,
  });

  const result = await removeSlackChannelsFromKb({
    channelIds: body.channelIds,
    isAdmin,
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 403 });
  }

  return Response.json({
    ok: true,
    removedChannelIds: result.removedChannelIds ?? [],
  });
}
