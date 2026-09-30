import {
  slackApi,
  slackMessagePermalink,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import {
  collectSlackUserMentionIds,
  formatSlackMessageText,
  resolveSlackUserNames,
} from "@/core/lib/connectors/providers/slack/resolve-users";

type SlackSearchMatch = {
  ts?: string;
  text?: string;
  user?: string;
  channel?: {
    id?: string;
    name?: string;
    is_channel?: boolean;
    is_group?: boolean;
    is_im?: boolean;
    is_mpim?: boolean;
  };
  permalink?: string;
};

export async function slackSearchMessages(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  query: string;
  count?: number;
  /** Default timestamp for chat tool; federated hybrid uses score. */
  sort?: "timestamp" | "score";
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const query = input.query.trim();
  if (!query) {
    throw new Error("query is required.");
  }

  const count = Math.min(Math.max(input.count ?? 20, 1), 100);
  const sort = input.sort ?? "timestamp";
  const page = await slackApi<{
    ok: boolean;
    messages?: { matches?: SlackSearchMatch[] };
  }>("search.messages", input.accessToken, {
    count: String(count),
    query,
    sort,
    sort_dir: "desc",
  });

  const matches = page.messages?.matches ?? [];
  const userNames = await resolveSlackUserNames(input.accessToken, [
    ...new Set([
      ...matches.map((match) => match.user?.trim() ?? "").filter(Boolean),
      ...collectSlackUserMentionIds(
        matches.map((match) => match.text?.trim() ?? "")
      ),
    ]),
  ]);

  return {
    messages: matches.map((match) => {
      const channelId = match.channel?.id?.trim() ?? "";
      const ts = match.ts?.trim() ?? "";
      const userId = match.user?.trim() || undefined;
      const rawText = match.text?.trim() ?? "";
      const permalink =
        match.permalink?.trim() ||
        (channelId && ts
          ? slackMessagePermalink({
              channelId,
              teamUrl: input.teamUrl,
              ts,
            })
          : undefined);
      return {
        channelId: channelId || undefined,
        channelName: match.channel?.name?.trim() || undefined,
        isIm: match.channel?.is_im === true,
        isMpim: match.channel?.is_mpim === true,
        permalink,
        text: formatSlackMessageText(rawText, userNames),
        ts: ts || undefined,
        user: userId,
        userName: userId ? userNames.get(userId) : undefined,
      };
    }),
    query,
    summary: `${matches.length} result${matches.length === 1 ? "" : "s"}`,
  };
}
