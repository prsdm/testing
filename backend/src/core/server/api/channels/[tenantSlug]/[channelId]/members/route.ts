import { z } from "zod";
import {
  addChannelMember,
  listChannelMemberPickerOptions,
  listChannelMembers,
  removeChannelMember,
} from "@/core/lib/chat/channel-queries";
import {
  assertChatOwner,
  assertChatReadable,
} from "@/core/lib/chat/chat-access";
import {
  getChatById,
  toTenantUserId,
  withTenantId,
} from "@/core/lib/db/queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

const addMemberSchema = z.object({
  userId: z.string().trim().min(1),
});

function toErrorResponse(error: unknown) {
  if (error instanceof ChatbotError) {
    return error.toResponse();
  }
  return Response.json({ error: "Request failed" }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; channelId: string }> }
) {
  const { tenantSlug, channelId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    return await withTenantId(authResult.tenant.id, async () => {
      const chat = await getChatById({ id: channelId });
      if (chat?.kind !== "channel") {
        return Response.json({ error: "Channel not found" }, { status: 404 });
      }

      const tenantUserId = toTenantUserId(authResult.userId);
      await assertChatReadable({
        authUserId: authResult.userId,
        chat,
        tenantUserId,
      });

      const members = await listChannelMembers({
        authUserId: authResult.userId,
        chat,
        tenantUserId,
      });

      let pickerOptions: Awaited<
        ReturnType<typeof listChannelMemberPickerOptions>
      > = [];
      try {
        await assertChatOwner({
          authUserId: authResult.userId,
          chat,
          tenantUserId,
        });
        pickerOptions = await listChannelMemberPickerOptions({
          authUserId: authResult.userId,
          chat,
          tenantUserId,
        });
      } catch {
        pickerOptions = [];
      }

      return Response.json({
        canManageMembers: members.some(
          (member) =>
            member.userId === authResult.userId && member.role === "owner"
        ),
        members: members.map((member) => ({
          createdAt: member.createdAt.toISOString(),
          displayName: member.displayName,
          email: member.email,
          image: member.image,
          role: member.role,
          userId: member.userId,
        })),
        pickerOptions,
      });
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; channelId: string }> }
) {
  const { tenantSlug, channelId } = await params;
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
    await withTenantId(authResult.tenant.id, async () => {
      const chat = await getChatById({ id: channelId });
      if (chat?.kind !== "channel") {
        throw new ChatbotError("not_found:api", "Channel not found");
      }

      const tenantUserId = toTenantUserId(authResult.userId);
      await addChannelMember({
        actorAuthUserId: authResult.userId,
        actorTenantUserId: tenantUserId,
        chat,
        memberAuthUserId: parsed.data.userId,
      });
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; channelId: string }> }
) {
  const { tenantSlug, channelId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const memberUserId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!memberUserId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    await withTenantId(authResult.tenant.id, async () => {
      const chat = await getChatById({ id: channelId });
      if (chat?.kind !== "channel") {
        throw new ChatbotError("not_found:api", "Channel not found");
      }

      const tenantUserId = toTenantUserId(authResult.userId);
      await removeChannelMember({
        actorAuthUserId: authResult.userId,
        actorTenantUserId: tenantUserId,
        chat,
        memberAuthUserId: memberUserId,
      });
    });

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
