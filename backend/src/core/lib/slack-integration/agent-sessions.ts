import { slackApi } from "@/core/lib/connectors/providers/slack/api";

export async function setSlackAgentSessionStatus(args: {
  botToken: string;
  channelId: string;
  threadTs: string;
  status: "processing" | "active";
  /** Used when Slack creates a new session (e.g. first @mention in a channel thread). */
  initiatorUserId?: string;
}) {
  await slackApi("agents.sessions.setStatus", args.botToken, {
    channel_id: args.channelId,
    status: args.status,
    thread_ts: args.threadTs,
    ...(args.initiatorUserId
      ? { initiator_user_id: args.initiatorUserId }
      : {}),
  });
}

export async function renameSlackAgentSession(args: {
  botToken: string;
  channelId: string;
  threadTs: string;
  title: string;
}) {
  const title = args.title.trim().slice(0, 120);
  if (!title) {
    return;
  }
  await slackApi("agents.sessions.rename", args.botToken, {
    channel_id: args.channelId,
    thread_ts: args.threadTs,
    title,
  });
}

export async function setSlackAgentSuggestedPrompts(args: {
  botToken: string;
  channelId: string;
  threadTs: string;
  title?: string;
  prompts: Array<{ title: string; message: string }>;
}) {
  if (args.prompts.length === 0) {
    return;
  }
  await slackApi("assistant.threads.setSuggestedPrompts", args.botToken, {
    channel_id: args.channelId,
    thread_ts: args.threadTs,
    ...(args.title ? { title: args.title } : {}),
    prompts: JSON.stringify(args.prompts.slice(0, 4)),
  });
}
