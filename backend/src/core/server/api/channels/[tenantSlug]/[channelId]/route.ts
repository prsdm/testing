import { z } from "zod";
import { ensureChannelKnowledgeBase } from "@/core/lib/chat/channel-knowledge-base";
import { listChannelMembers } from "@/core/lib/chat/channel-queries";
import { assertChatReadable } from "@/core/lib/chat/chat-access";
import {
  getChatById,
  toTenantUserId,
  updateChatThreadTagCatalog,
  withTenantId,
} from "@/core/lib/db/queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import {
  channelThreadTagCatalogSchema,
  normalizeChannelThreadTagCatalog,
  parseChannelThreadTagCatalog,
} from "@/shared/chat/thread-tags";
import { ChatbotError } from "@/shared/errors";

const patchChannelSchema = z.object({
  threadTagCatalog: channelThreadTagCatalogSchema,
});

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
    const payload = await withTenantId(authResult.tenant.id, async () => {
      const row = await getChatById({ id: channelId });
      if (row?.kind !== "channel") {
        return null;
      }
      await assertChatReadable({
        authUserId: authResult.userId,
        chat: row,
        tenantUserId: toTenantUserId(authResult.userId),
      });

      const knowledgeBaseId = await ensureChannelKnowledgeBase({
        actorAuthUserId: authResult.userId,
        chat: row,
      });

      const tenantUserId = toTenantUserId(authResult.userId);
      const members = await listChannelMembers({
        authUserId: authResult.userId,
        chat: row,
        tenantUserId,
      });
      const createdByMember =
        members.find((member) => member.role === "owner") ?? members.at(0);

      return {
        createdAt: row.createdAt.toISOString(),
        createdByName: createdByMember?.displayName ?? "Unknown",
        id: row.id,
        knowledgeBaseId,
        threadTagCatalog: parseChannelThreadTagCatalog(row.threadTagCatalog),
        title: row.title,
      };
    });

    if (!payload) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    return Response.json({
      channel: payload,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json({ error: "Failed to load channel" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; channelId: string }> }
) {
  const { tenantSlug, channelId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let threadTagCatalog: ReturnType<typeof normalizeChannelThreadTagCatalog>;
  try {
    const body = patchChannelSchema.parse(await request.json());
    threadTagCatalog = normalizeChannelThreadTagCatalog(body.threadTagCatalog);
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameter threadTagCatalog is required."
    ).toResponse();
  }

  try {
    const updated = await withTenantId(authResult.tenant.id, async () => {
      const row = await getChatById({ id: channelId });
      if (row?.kind !== "channel") {
        return null;
      }
      await assertChatReadable({
        authUserId: authResult.userId,
        chat: row,
        tenantUserId: toTenantUserId(authResult.userId),
      });

      const stored = await updateChatThreadTagCatalog({
        chatId: channelId,
        threadTagCatalog: threadTagCatalog.length > 0 ? threadTagCatalog : null,
      });

      return parseChannelThreadTagCatalog(stored);
    });

    if (!updated) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    return Response.json({
      channel: {
        id: channelId,
        threadTagCatalog: updated,
      },
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return Response.json(
      { error: "Failed to update channel tags" },
      { status: 500 }
    );
  }
}
