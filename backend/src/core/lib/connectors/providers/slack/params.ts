import type { ToolParam } from "@/core/lib/connectors/providers/types";

const CHANNEL_ID_PARAM: ToolParam = {
  description: "Slack channel ID from a prior tool result",
  name: "channelId",
  required: false,
  type: "string",
};

const CHANNEL_NAME_PARAM: ToolParam = {
  description:
    'Slack channel name (with or without "#") when channelId is unknown',
  name: "channelName",
  required: false,
  type: "string",
};

export const SLACK_PARAMS: Record<string, ToolParam[]> = {
  slackCreateChannel: [
    {
      description:
        "Channel name (lowercase letters, numbers, hyphens, underscores; max 80 characters)",
      name: "name",
      required: true,
      type: "string",
    },
    {
      description: "Create a private channel instead of public (default false)",
      name: "isPrivate",
      required: false,
      type: "boolean",
    },
  ],
  slackGetConversationHistory: [
    CHANNEL_ID_PARAM,
    CHANNEL_NAME_PARAM,
    {
      description: "Maximum messages to return (1–999, default 100)",
      name: "limit",
      required: false,
      type: "number",
    },
    {
      description:
        "Pagination cursor from a prior slackGetConversationHistory result",
      name: "cursor",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional Unix timestamp filter (seconds). For “today” or date-range queries, prefer slackSearchMessages with in:#channel after:YYYY-MM-DD instead.",
      name: "oldest",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional Unix timestamp filter (seconds). Prefer slackSearchMessages for date-specific queries.",
      name: "latest",
      required: false,
      type: "string",
    },
  ],
  slackGetDirectMessageHistory: [
    {
      description:
        "DM partner: first name (e.g. Prasad), full name, @username, email, or Slack user id from slackListUsers",
      name: "user",
      required: true,
      type: "string",
    },
    {
      description: "Maximum messages to return (1–999, default 100)",
      name: "limit",
      required: false,
      type: "number",
    },
    {
      description:
        "Pagination cursor from a prior slackGetDirectMessageHistory result",
      name: "cursor",
      required: false,
      type: "string",
    },
    {
      description: "Optional Unix timestamp filter (seconds)",
      name: "oldest",
      required: false,
      type: "string",
    },
    {
      description: "Optional Unix timestamp filter (seconds)",
      name: "latest",
      required: false,
      type: "string",
    },
  ],
  slackGetThreadReplies: [
    CHANNEL_ID_PARAM,
    CHANNEL_NAME_PARAM,
    {
      description:
        'Parent message ts from slackGetConversationHistory where replyCount > 0 (for example "1234567890.123456"). Do not use messages with replyCount 0 — they have no thread.',
      name: "threadTs",
      required: true,
      type: "string",
    },
    {
      description: "Maximum messages to return (1–100, default 100)",
      name: "limit",
      required: false,
      type: "number",
    },
    {
      description:
        "Pagination cursor from a prior slackGetThreadReplies result",
      name: "cursor",
      required: false,
      type: "string",
    },
  ],
  slackListChannels: [
    {
      description: "Maximum channels to return (1–200, default 100)",
      name: "limit",
      required: false,
      type: "number",
    },
    {
      description: "Pagination cursor from a prior slackListChannels result",
      name: "cursor",
      required: false,
      type: "string",
    },
  ],
  slackListUsers: [
    {
      description: "Pagination cursor from a prior slackListUsers result",
      name: "cursor",
      required: false,
      type: "string",
    },
  ],
  slackPostDirectMessage: [
    {
      description:
        "Recipient: first name (e.g. Prasad), full name, @username, email, or Slack user id from slackListUsers",
      name: "user",
      required: true,
      type: "string",
    },
    {
      description: "Direct message text to send",
      name: "text",
      required: true,
      type: "string",
    },
  ],
  slackPostMessage: [
    CHANNEL_ID_PARAM,
    CHANNEL_NAME_PARAM,
    {
      description: "Message text to post as a top-level channel message",
      name: "text",
      required: true,
      type: "string",
    },
  ],
  slackSearchMessages: [
    {
      description: "Search query (Slack search syntax supported)",
      name: "query",
      required: true,
      type: "string",
    },
    {
      description: "Maximum messages to return (1–100, default 20)",
      name: "count",
      required: false,
      type: "number",
    },
  ],
  slackUpdateMessage: [
    CHANNEL_ID_PARAM,
    CHANNEL_NAME_PARAM,
    {
      description: "Timestamp of the message to update",
      name: "messageTs",
      required: true,
      type: "string",
    },
    {
      description: "Updated message text",
      name: "text",
      required: true,
      type: "string",
    },
  ],
};
