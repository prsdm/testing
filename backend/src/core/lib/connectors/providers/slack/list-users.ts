import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";

type SlackApiUser = {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    display_name?: string;
    real_name?: string;
    email?: string;
  };
};

export async function slackListUsers(input: {
  tenantId: string;
  accessToken: string;
  cursor?: string;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const params: Record<string, string> = { limit: "200" };
  if (input.cursor?.trim()) {
    params.cursor = input.cursor.trim();
  }

  const page = await slackApi<{
    ok: boolean;
    members?: SlackApiUser[];
    response_metadata?: { next_cursor?: string };
  }>("users.list", input.accessToken, params);

  const users = (page.members ?? [])
    .filter((member) => !member.deleted && !member.is_bot && member.id)
    .map((member) => ({
      displayName: member.profile?.display_name?.trim() || undefined,
      email: member.profile?.email?.trim().toLowerCase() || undefined,
      id: member.id as string,
      realName: member.profile?.real_name?.trim() || undefined,
      username: member.name?.trim() || (member.id as string),
    }));

  return {
    nextCursor: page.response_metadata?.next_cursor?.trim() || undefined,
    summary: `${users.length} user${users.length === 1 ? "" : "s"}`,
    users,
  };
}
