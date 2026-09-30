import type { Provider } from "@/core/lib/connectors/providers/types";
import { DEFAULT_SLACK_OAUTH_USER_SCOPES } from "./scopes";

export const SLACK_PROVIDER_ID = "slack";

export const slackProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Communication",
  description:
    "Connect your Slack workspace to list channels, read history, search messages, and post from chat.",
  iconColor: "bg-[#4A154B]",
  id: SLACK_PROVIDER_ID,
  name: "Slack",
  scopes: [...DEFAULT_SLACK_OAUTH_USER_SCOPES],
  tools: [
    {
      description:
        "List public and private channels the connected user can access.",
      id: "slackListChannels",
      name: "List Slack channels",
    },
    {
      description:
        "List Slack workspace members to resolve a Slack user id before DMs or posts. Do NOT use as the company directory — use peopleSearch for who-is / department / role questions.",
      id: "slackListUsers",
      name: "List Slack users",
    },
    {
      description:
        "Search Slack messages (channels and DMs) with Slack query syntax.",
      id: "slackSearchMessages",
      name: "Search Slack messages",
    },
    {
      description:
        "Fetch recent messages from a Slack channel (not DMs). Each message includes replyCount when it has a thread. Call slackListChannels first when the channel is unknown. For today/yesterday, use slackSearchMessages with in:#channel after:YYYY-MM-DD.",
      id: "slackGetConversationHistory",
      name: "Get Slack conversation history",
    },
    {
      description:
        "Fetch recent messages from a Slack DM with one person. Use ONLY when the user explicitly wants Slack DM history (for example: 'recent 5 Slack DMs from Prasad', 'show our Slack DM'). Resolve the person via slackListUsers when needed.",
      id: "slackGetDirectMessageHistory",
      name: "Get Slack direct message history",
    },
    {
      description:
        "Fetch replies under a threaded parent message. Call slackGetConversationHistory first and use the ts of a message with replyCount > 0 as threadTs. replyCount 0 means there are no thread replies.",
      id: "slackGetThreadReplies",
      name: "Get Slack thread replies",
    },
    {
      description: "Post a message to a Slack channel.",
      id: "slackPostMessage",
      name: "Post Slack message",
    },
    {
      description:
        "Send a direct message to a workspace member by first name, full name, @username, or email. Prefer slackListUsers when unsure.",
      id: "slackPostDirectMessage",
      name: "Send Slack direct message",
    },
    {
      description:
        "Edit an existing channel message. Provide channelId or channelName plus messageTs from a prior result.",
      id: "slackUpdateMessage",
      name: "Update Slack message",
    },
    {
      description: "Create a new public or private Slack channel by name.",
      id: "slackCreateChannel",
      name: "Create Slack channel",
    },
  ],
};
