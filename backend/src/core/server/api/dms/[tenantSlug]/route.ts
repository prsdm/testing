import { z } from "zod";
import { getUnreadCountsForChats } from "@/core/lib/chat/chat-unread";
import {
  createGroupDirectMessage,
  createOrGetDirectMessage,
  listDirectMessagesForUser,
  listDmMemberPickerOptions,
} from "@/core/lib/chat/dm-queries";
import { toTenantUserId, withTenantId } from "@/core/lib/db/queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

const createDmSchema = z.union([
  z.object({
    peerUserId: z.string().trim().min(1),
  }),
  z.object({
    memberUserIds: z.array(z.string().trim().min(1)).min(2),
  }),
]);

function serializeDm(
  dm: Awaited<ReturnType<typeof listDirectMessagesForUser>>[number],
  unreadCount: number
) {
  return {
    createdAt: dm.createdAt.toISOString(),
    id: dm.id,
    isGroup: dm.isGroup,
    members: dm.members,
    peerDisplayName: dm.peerDisplayName,
    peerEmail: dm.peerEmail,
    peerImage: dm.peerImage,
    peerUserId: dm.peerUserId,
    tenantId: dm.tenantId,
    title: dm.title,
    unreadCount,
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

  const url = new URL(request.url);
  const picker = url.searchParams.get("picker") === "1";

  const payload = await withTenantId(authResult.tenant.id, async () => {
    if (picker) {
      const members = await listDmMemberPickerOptions({
        authUserId: authResult.userId,
        tenantId: authResult.tenant.id,
      });
      return { kind: "picker" as const, members };
    }

    const dms = await listDirectMessagesForUser({
      authUserId: authResult.userId,
      tenantId: authResult.tenant.id,
    });
    const unreadCounts = await getUnreadCountsForChats({
      authUserId: authResult.userId,
      chatIds: dms.map((dm) => dm.id),
    });
    return { dms, kind: "list" as const, unreadCounts };
  });

  if (payload.kind === "picker") {
    return Response.json({ members: payload.members });
  }

  return Response.json({
    dms: payload.dms.map((dm) =>
      serializeDm(dm, payload.unreadCounts.get(dm.id) ?? 0)
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

  const parsed = createDmSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid DM payload" }, { status: 400 });
  }

  try {
    const chat = await withTenantId(authResult.tenant.id, () => {
      if ("memberUserIds" in parsed.data) {
        return createGroupDirectMessage({
          creatorAuthUserId: authResult.userId,
          creatorTenantUserId: toTenantUserId(authResult.userId),
          memberAuthUserIds: parsed.data.memberUserIds,
          tenantId: authResult.tenant.id,
        });
      }
      return createOrGetDirectMessage({
        creatorAuthUserId: authResult.userId,
        creatorTenantUserId: toTenantUserId(authResult.userId),
        peerAuthUserId: parsed.data.peerUserId,
        tenantId: authResult.tenant.id,
      });
    });

    return Response.json({
      dm: {
        id: chat.id,
        tenantId: chat.tenantId,
      },
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json({ error: "Failed to open DM" }, { status: 500 });
  }
}
