import type { Provider } from "@/shared/connectors/provider-types";
import { DEFAULT_GMAIL_OAUTH_SCOPES } from "./scopes";

export const GMAIL_PROVIDER_ID = "gmail";

export const gmailProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Communication",
  description:
    "Connect your Google account to read, search, send, and reply to email from chat.",
  iconColor: "bg-red-600",
  id: GMAIL_PROVIDER_ID,
  name: "Gmail",
  scopes: [...DEFAULT_GMAIL_OAUTH_SCOPES],
  tools: [
    {
      description:
        "List recent messages from a mailbox label (default INBOX). Use for unread or recent inbox-only requests. For cross-app history with a person, combine Gmail search with other connected tools or knowledge base search.",
      id: "gmailListMessages",
      name: "List Gmail messages",
    },
    {
      description:
        "Search Gmail only with Gmail query syntax (from:, to:, subject:, is:unread, newer_than:7d). Use when the user explicitly wants email-only results. For broader workspace context, combine with other connected tools or knowledge base search.",
      id: "gmailSearchMessages",
      name: "Search Gmail",
    },
    {
      description:
        "Read the full body of one email by messageId from a prior list or search result.",
      id: "gmailGetMessage",
      name: "Get Gmail message",
    },
    {
      description:
        "Read all messages in an email thread by threadId from a prior list, search, or get-message result. Use before replying when full conversation context is needed.",
      id: "gmailGetThread",
      name: "Get Gmail thread",
    },
    {
      description: "Send a new email immediately with to, subject, and body.",
      id: "gmailSendMessage",
      name: "Send Gmail message",
    },
    {
      description:
        "Save an email as a draft without sending. Use when the user wants to draft or review before send. Returns draftId for gmailSendDraft.",
      id: "gmailCreateDraft",
      name: "Create Gmail draft",
    },
    {
      description:
        "Send a previously created draft using draftId from gmailCreateDraft.",
      id: "gmailSendDraft",
      name: "Send Gmail draft",
    },
    {
      description:
        "Reply in the same thread using messageId from a prior list, search, thread, or get-message result. Set replyAll true to include original recipients.",
      id: "gmailReplyToMessage",
      name: "Reply to Gmail message",
    },
  ],
};
