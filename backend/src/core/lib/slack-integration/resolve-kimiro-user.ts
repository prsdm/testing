import { and, eq } from "drizzle-orm";
import { assertChatApiAccessForTenant } from "@/core/lib/chat/assert-chat-api-access";
import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { getDb } from "@/core/lib/db/client";
import { withTenantId } from "@/core/lib/db/queries";
import { tenantMembers, tenants } from "@/core/lib/db/tables";

const db = getDb();

type SlackUserProfile = {
  email?: string;
  real_name?: string;
  display_name?: string;
};

export type ResolvedKimiroSlackUser = {
  authUserId: string;
  email: string;
  name: string | null;
};

export async function resolveKimiroUserForSlack(args: {
  tenantId: string;
  slackUserId: string;
  botToken: string;
}): Promise<ResolvedKimiroSlackUser | null> {
  const info = await slackApi<{
    ok: boolean;
    user?: { profile?: SlackUserProfile };
  }>("users.info", args.botToken, { user: args.slackUserId });
  const email = info.user?.profile?.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const member = await withTenantId(args.tenantId, async () => {
    const [row] = await db
      .select({
        authUserId: tenantMembers.authUserId,
        email: tenantMembers.email,
      })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMembers.tenantId, args.tenantId),
          eq(tenantMembers.email, email),
          eq(tenantMembers.isActive, true),
          eq(tenants.status, "active")
        )
      )
      .limit(1);
    return row ?? null;
  });

  if (!member?.authUserId) {
    return null;
  }

  const accessOk = await assertChatApiAccessForTenant({
    tenantId: args.tenantId,
    userEmail: email,
    userId: member.authUserId,
  });
  if (accessOk === "forbidden") {
    return null;
  }

  const displayName =
    info.user?.profile?.display_name?.trim() ||
    info.user?.profile?.real_name?.trim() ||
    null;

  return {
    authUserId: member.authUserId,
    email,
    name: displayName,
  };
}
