import { z } from "zod";
import {
  createChannel,
  listChannelsForUser,
} from "@/core/lib/chat/channel-queries";
import { getUnreadCountsForChats } from "@/core/lib/chat/chat-unread";
import { toTenantUserId, withTenantId } from "@/core/lib/db/queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

const createChannelSchema = z.object({
  memberUserIds: z.array(z.string().trim().min(1)).default([]),
  name: z.string().trim().min(1).max(120),
});

function serializeChannel(
  channel: Awaited<ReturnType<typeof listChannelsForUser>>[number],
  unreadCount: number
) {
  return {
    createdAt: channel.createdAt.toISOString(),
    id: channel.id,
    knowledgeBaseId: channel.knowledgeBaseId,
    participantRole: channel.participantRole,
    tenantId: channel.tenantId,
    title: channel.title,
    unreadCount,
    userId: channel.userId,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const payload = await withTenantId(authResult.tenant.id, async () => {
    const channels = await listChannelsForUser({
      authUserId: authResult.userId,
      tenantId: authResult.tenant.id,
    });
    const unreadCounts = await getUnreadCountsForChats({
      authUserId: authResult.userId,
      chatIds: channels.map((channel) => channel.id),
    });
    return { channels, unreadCounts };
  });

  return Response.json({
    channels: payload.channels.map((channel) =>
      serializeChannel(channel, payload.unreadCounts.get(channel.id) ?? 0)
    ),
  });
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

  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid channel payload" }, { status: 400 });
  }

  try {
    const channel = await withTenantId(authResult.tenant.id, () =>
      createChannel({
        creatorAuthUserId: authResult.userId,
        creatorTenantUserId: toTenantUserId(authResult.userId),
        memberAuthUserIds: parsed.data.memberUserIds,
        name: parsed.data.name,
        tenantId: authResult.tenant.id,
      })
    );

    return Response.json(
      {
        channel: {
          createdAt: channel.createdAt.toISOString(),
          id: channel.id,
          knowledgeBaseId: channel.knowledgeBaseId,
          participantRole: "owner" as const,
          tenantId: channel.tenantId,
          title: channel.title,
          unreadCount: 0,
          userId: channel.userId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json(
      { error: "Failed to create channel" },
      { status: 500 }
    );
  }
}
