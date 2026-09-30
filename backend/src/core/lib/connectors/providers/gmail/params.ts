import type { ToolParam } from "@/core/lib/connectors/providers/types";

export const GMAIL_PARAMS: Record<string, ToolParam[]> = {
  gmailCreateDraft: [
    {
      description: "Recipient email address or comma-separated addresses",
      name: "to",
      required: true,
      type: "string",
    },
    {
      description: "Email subject line",
      name: "subject",
      required: true,
      type: "string",
    },
    {
      description: "Plain-text draft body",
      name: "body",
      required: true,
      type: "string",
    },
    {
      description: "Optional CC recipients",
      name: "cc",
      required: false,
      type: "string",
    },
    {
      description: "Optional BCC recipients",
      name: "bcc",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional thread id when saving a draft reply in an existing conversation",
      name: "threadId",
      required: false,
      type: "string",
    },
  ],
  gmailGetMessage: [
    {
      description: "Gmail message id from a prior list or search result",
      name: "messageId",
      required: true,
      type: "string",
    },
  ],
  gmailGetThread: [
    {
      description:
        "Gmail thread id from a prior list, search, or get-message result",
      name: "threadId",
      required: true,
      type: "string",
    },
    {
      description:
        "Maximum messages to return from the thread (1–50, default 20). When truncated, returns the latest messages.",
      name: "maxMessages",
      required: false,
      type: "number",
    },
  ],
  gmailListMessages: [
    {
      description:
        'Gmail label id (default "INBOX"). Examples: SENT, STARRED, DRAFT',
      name: "labelId",
      required: false,
      type: "string",
    },
    {
      description: "Maximum messages to return (1–50, default 20)",
      name: "maxResults",
      required: false,
      type: "number",
    },
    {
      description: "Pagination token from a prior gmailListMessages result",
      name: "pageToken",
      required: false,
      type: "string",
    },
  ],
  gmailReplyToMessage: [
    {
      description: "Gmail message id to reply to",
      name: "messageId",
      required: true,
      type: "string",
    },
    {
      description: "Plain-text reply body",
      name: "body",
      required: true,
      type: "string",
    },
    {
      description: "Reply to all original recipients (default false)",
      name: "replyAll",
      required: false,
      type: "boolean",
    },
  ],
  gmailSearchMessages: [
    {
      description: "Gmail search query (Gmail search syntax supported)",
      name: "query",
      required: true,
      type: "string",
    },
    {
      description: "Maximum messages to return (1–50, default 20)",
      name: "maxResults",
      required: false,
      type: "number",
    },
    {
      description: "Pagination token from a prior gmailSearchMessages result",
      name: "pageToken",
      required: false,
      type: "string",
    },
  ],
  gmailSendDraft: [
    {
      description: "Draft id from a prior gmailCreateDraft result",
      name: "draftId",
      required: true,
      type: "string",
    },
  ],
  gmailSendMessage: [
    {
      description: "Recipient email address or comma-separated addresses",
      name: "to",
      required: true,
      type: "string",
    },
    {
      description: "Email subject line",
      name: "subject",
      required: true,
      type: "string",
    },
    {
      description: "Plain-text email body",
      name: "body",
      required: true,
      type: "string",
    },
    {
      description: "Optional CC recipients",
      name: "cc",
      required: false,
      type: "string",
    },
    {
      description: "Optional BCC recipients",
      name: "bcc",
      required: false,
      type: "string",
    },
  ],
};
