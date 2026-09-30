export const SLACK_ACTION_TOOL_IDS = [
  "slackListChannels",
  "slackListUsers",
  "slackSearchMessages",
  "slackGetConversationHistory",
  "slackGetDirectMessageHistory",
  "slackGetThreadReplies",
  "slackPostMessage",
  "slackPostDirectMessage",
  "slackUpdateMessage",
  "slackCreateChannel",
] as const;
export const SLACK_TOOL_IDS = [...SLACK_ACTION_TOOL_IDS] as const;

export function slackToolIdsForConnector(): string[] {
  return [...SLACK_ACTION_TOOL_IDS];
}
