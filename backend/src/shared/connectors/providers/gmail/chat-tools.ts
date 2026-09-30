/** Gmail action tools (unified Google OAuth with Drive/Docs). */
export const GMAIL_ACTION_TOOL_IDS = [
  "gmailListMessages",
  "gmailSearchMessages",
  "gmailGetMessage",
  "gmailGetThread",
  "gmailSendMessage",
  "gmailCreateDraft",
  "gmailSendDraft",
  "gmailReplyToMessage",
] as const;

export const GMAIL_TOOL_IDS = [...GMAIL_ACTION_TOOL_IDS] as const;

export type GmailToolId = (typeof GMAIL_TOOL_IDS)[number];

export function isGmailToolId(toolId: string): toolId is GmailToolId {
  return (GMAIL_TOOL_IDS as readonly string[]).includes(toolId);
}

export function gmailToolIdsForConnector(): string[] {
  return [...GMAIL_ACTION_TOOL_IDS];
}
