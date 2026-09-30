import { slackMessagePermalink } from "@/core/lib/connectors/providers/slack/api";
import {
  collectSlackUserMentionIds,
  formatSlackMessageText,
  resolveSlackUserNames,
} from "@/core/lib/connectors/providers/slack/resolve-users";

type SlackApiMessage = {
  type?: string;
  ts?: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
};

export function normalizeSlackMessages(input: {
  messages: SlackApiMessage[];
  teamUrl: string | null;
  channelId: string;
  userNames?: Map<string, string>;
}) {
  return input.messages.map((message) => {
    const ts = message.ts?.trim() ?? "";
    const userId = message.user?.trim() || undefined;
    const rawText = message.text?.trim() ?? "";
    const userName = userId ? input.userNames?.get(userId) : undefined;
    const text = input.userNames
      ? formatSlackMessageText(rawText, input.userNames)
      : rawText;
    return {
      permalink:
        ts && input.channelId
          ? slackMessagePermalink({
              channelId: input.channelId,
              teamUrl: input.teamUrl,
              ts,
            })
          : undefined,
      replyCount:
        typeof message.reply_count === "number"
          ? message.reply_count
          : undefined,
      text,
      threadTs: message.thread_ts?.trim() || undefined,
      ts: ts || undefined,
      type: message.type?.trim() || "message",
      user: userId,
      userName,
    };
  });
}

export async function normalizeSlackMessagesWithUsers(input: {
  accessToken: string;
  messages: SlackApiMessage[];
  teamUrl: string | null;
  channelId: string;
}) {
  const userIds = [
    ...new Set([
      ...input.messages
        .map((message) => message.user?.trim())
        .filter((userId): userId is string => Boolean(userId)),
      ...collectSlackUserMentionIds(
        input.messages.map((message) => message.text?.trim() ?? "")
      ),
    ]),
  ];
  const userNames = await resolveSlackUserNames(input.accessToken, userIds);
  return normalizeSlackMessages({
    channelId: input.channelId,
    messages: input.messages,
    teamUrl: input.teamUrl,
    userNames,
  });
}
