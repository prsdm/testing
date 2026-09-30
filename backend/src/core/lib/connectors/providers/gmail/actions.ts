import { gmailFetch } from "@/core/lib/connectors/providers/gmail/api";
import { assertGmailActionAllowed } from "@/core/lib/connectors/providers/gmail/auth";
import {
  buildPlainTextMimeHeaderLines,
  encodeGmailRawMessage,
  extractGmailMessageBody,
  type GmailMessagePayload,
  getGmailHeader,
  gmailDraftComposeLink,
  gmailThreadLink,
  truncateGmailBody,
} from "@/core/lib/connectors/providers/gmail/message-utils";

type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
};

type GmailThreadResponse = {
  id?: string;
  historyId?: string;
  messages?: GmailMessageResponse[];
};

function normalizeLabelId(labelId?: string) {
  const trimmed = labelId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "INBOX";
}

function normalizeMaxResults(value: number | undefined, fallback: number) {
  return Math.min(Math.max(value ?? fallback, 1), 50);
}

function fetchMessageMetadata(accessToken: string, messageId: string) {
  return gmailFetch<GmailMessageResponse>(
    accessToken,
    `/users/me/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`
  );
}

function mapFullMessageDetail(
  message: GmailMessageResponse,
  fallbackMessageId?: string
) {
  const headers = message.payload?.headers;
  const threadId = message.threadId?.trim() ?? "";
  const body = truncateGmailBody(
    extractGmailMessageBody(message.payload ?? {})
  );

  return {
    body: body || undefined,
    cc: getGmailHeader(headers, "Cc") || undefined,
    date: getGmailHeader(headers, "Date") || undefined,
    from: getGmailHeader(headers, "From") || undefined,
    id: message.id?.trim() || fallbackMessageId || undefined,
    labelIds: message.labelIds ?? [],
    snippet: message.snippet?.trim() || undefined,
    subject: getGmailHeader(headers, "Subject") || "(no subject)",
    threadId: threadId || undefined,
    to: getGmailHeader(headers, "To") || undefined,
  };
}

function sortThreadMessages(messages: GmailMessageResponse[]) {
  return [...messages].sort((left, right) => {
    const leftDate = Number(left.internalDate ?? 0);
    const rightDate = Number(right.internalDate ?? 0);
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    return (left.id ?? "").localeCompare(right.id ?? "");
  });
}

function mapMessageSummary(message: GmailMessageResponse) {
  const headers = message.payload?.headers;
  const threadId = message.threadId?.trim() ?? "";
  const id = message.id?.trim() ?? "";
  return {
    date: getGmailHeader(headers, "Date") || undefined,
    from: getGmailHeader(headers, "From") || undefined,
    id: id || undefined,
    link: threadId ? gmailThreadLink(threadId) : undefined,
    snippet: message.snippet?.trim() || undefined,
    subject: getGmailHeader(headers, "Subject") || "(no subject)",
    threadId: threadId || undefined,
    to: getGmailHeader(headers, "To") || undefined,
  };
}

async function listMessageSummaries(input: {
  accessToken: string;
  labelId?: string;
  searchQuery?: string;
  maxResults: number;
  pageToken?: string;
}) {
  const query = new URLSearchParams({
    maxResults: String(input.maxResults),
  });
  if (input.labelId) {
    query.set("labelIds", input.labelId);
  }
  if (input.searchQuery) {
    query.set("q", input.searchQuery);
  }
  if (input.pageToken?.trim()) {
    query.set("pageToken", input.pageToken.trim());
  }

  const page = await gmailFetch<GmailListResponse>(
    input.accessToken,
    `/users/me/messages?${query.toString()}`
  );

  const messageIds = (page.messages ?? [])
    .map((message) => message.id?.trim())
    .filter((id): id is string => Boolean(id));

  const messages = await Promise.all(
    messageIds.map(async (messageId) => {
      const message = await fetchMessageMetadata(input.accessToken, messageId);
      return mapMessageSummary(message);
    })
  );

  return {
    messageCount: messages.length,
    messages,
    nextPageToken: page.nextPageToken?.trim() || undefined,
    resultSizeEstimate: page.resultSizeEstimate,
  };
}

export async function gmailListMessages(input: {
  tenantId: string;
  accessToken: string;
  labelId?: string;
  maxResults?: number;
  pageToken?: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const labelId = normalizeLabelId(input.labelId);
  const maxResults = normalizeMaxResults(input.maxResults, 20);
  const result = await listMessageSummaries({
    accessToken: input.accessToken,
    labelId,
    maxResults,
    pageToken: input.pageToken,
  });

  const summary =
    result.messageCount === 0
      ? `${labelId} · no messages`
      : `${labelId} · ${result.messageCount} message${result.messageCount === 1 ? "" : "s"}`;

  return {
    labelId,
    ...result,
    summary,
  };
}

export async function gmailSearchMessages(input: {
  tenantId: string;
  accessToken: string;
  query: string;
  maxResults?: number;
  pageToken?: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const query = input.query.trim();
  if (!query) {
    throw new Error("query is required.");
  }

  const maxResults = normalizeMaxResults(input.maxResults, 20);
  const result = await listMessageSummaries({
    accessToken: input.accessToken,
    maxResults,
    pageToken: input.pageToken,
    searchQuery: query,
  });

  const summary =
    result.messageCount === 0
      ? `No messages matched "${query}"`
      : `"${query}" · ${result.messageCount} message${result.messageCount === 1 ? "" : "s"}`;

  return {
    query,
    ...result,
    summary,
  };
}

export async function gmailGetMessage(input: {
  tenantId: string;
  accessToken: string;
  messageId: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const messageId = input.messageId.trim();
  if (!messageId) {
    throw new Error("messageId is required.");
  }

  const message = await gmailFetch<GmailMessageResponse>(
    input.accessToken,
    `/users/me/messages/${encodeURIComponent(messageId)}?format=full`
  );

  const threadId = message.threadId?.trim() ?? "";

  return {
    ...mapFullMessageDetail(message, messageId),
    link: threadId ? gmailThreadLink(threadId) : undefined,
  };
}

export async function gmailGetThread(input: {
  tenantId: string;
  accessToken: string;
  threadId: string;
  maxMessages?: number;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const threadId = input.threadId.trim();
  if (!threadId) {
    throw new Error("threadId is required.");
  }

  const maxMessages = normalizeMaxResults(input.maxMessages, 20);

  const thread = await gmailFetch<GmailThreadResponse>(
    input.accessToken,
    `/users/me/threads/${encodeURIComponent(threadId)}?format=full`
  );

  const allMessages = sortThreadMessages(thread.messages ?? []);
  const totalMessageCount = allMessages.length;
  const truncated = totalMessageCount > maxMessages;
  const selectedMessages = truncated
    ? allMessages.slice(-maxMessages)
    : allMessages;
  const messages = selectedMessages.map((message) =>
    mapFullMessageDetail(message)
  );

  const subject =
    allMessages
      .map((message) => getGmailHeader(message.payload?.headers, "Subject"))
      .find((value) => value.trim()) || "(no subject)";

  let summary: string;
  if (totalMessageCount === 0) {
    summary = "Empty thread";
  } else if (truncated) {
    summary = `${totalMessageCount} messages · showing latest ${messages.length}`;
  } else {
    summary = `${totalMessageCount} message${totalMessageCount === 1 ? "" : "s"}`;
  }

  return {
    link: gmailThreadLink(threadId),
    messageCount: messages.length,
    messages,
    omittedMessageCount: truncated ? totalMessageCount - messages.length : 0,
    subject,
    summary,
    threadId: thread.id?.trim() || threadId,
    totalMessageCount,
    truncated,
  };
}

function buildAddressList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

export async function gmailSendMessage(input: {
  tenantId: string;
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to) {
    throw new Error("to is required.");
  }
  if (!subject) {
    throw new Error("subject is required.");
  }
  if (!body) {
    throw new Error("body is required.");
  }

  const sent = await gmailFetch<{ id?: string; threadId?: string }>(
    input.accessToken,
    "/users/me/messages/send",
    {
      body: JSON.stringify({
        raw: encodeGmailRawMessage(
          buildPlainTextMimeHeaderLines({
            bcc: input.bcc,
            body,
            cc: input.cc,
            subject,
            to,
          })
        ),
      }),
      method: "POST",
    }
  );

  const threadId = sent.threadId?.trim() ?? "";
  return {
    id: sent.id?.trim() || undefined,
    link: threadId ? gmailThreadLink(threadId) : undefined,
    subject,
    threadId: threadId || undefined,
    to,
  };
}

export async function gmailReplyToMessage(input: {
  tenantId: string;
  accessToken: string;
  messageId: string;
  body: string;
  replyAll?: boolean;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const messageId = input.messageId.trim();
  const body = input.body.trim();
  if (!messageId) {
    throw new Error("messageId is required.");
  }
  if (!body) {
    throw new Error("body is required.");
  }

  const original = await gmailFetch<GmailMessageResponse>(
    input.accessToken,
    `/users/me/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Message-ID&metadataHeaders=Reply-To`
  );

  const headers = original.payload?.headers;
  const messageIdHeader = getGmailHeader(headers, "Message-ID");
  const from = getGmailHeader(headers, "From");
  const replyTo = getGmailHeader(headers, "Reply-To");
  const subject = getGmailHeader(headers, "Subject") || "(no subject)";
  const replySubject = subject.toLowerCase().startsWith("re:")
    ? subject
    : `Re: ${subject}`;
  const to = replyTo || from;
  if (!to) {
    throw new Error("Could not determine reply recipient for this message.");
  }

  const headerLines = [`To: ${to}`, `Subject: ${replySubject}`];

  if (input.replyAll) {
    const cc = buildAddressList([
      getGmailHeader(headers, "To"),
      getGmailHeader(headers, "Cc"),
    ]);
    if (cc) {
      headerLines.push(`Cc: ${cc}`);
    }
  }

  if (messageIdHeader) {
    headerLines.push(`In-Reply-To: ${messageIdHeader}`);
    headerLines.push(`References: ${messageIdHeader}`);
  }

  headerLines.push('Content-Type: text/plain; charset="UTF-8"', "", body);

  const threadId = original.threadId?.trim();
  const sent = await gmailFetch<{ id?: string; threadId?: string }>(
    input.accessToken,
    "/users/me/messages/send",
    {
      body: JSON.stringify({
        raw: encodeGmailRawMessage(headerLines),
        ...(threadId ? { threadId } : {}),
      }),
      method: "POST",
    }
  );

  const sentThreadId = sent.threadId?.trim() ?? threadId ?? "";
  return {
    id: sent.id?.trim() || undefined,
    inReplyTo: messageId,
    link: sentThreadId ? gmailThreadLink(sentThreadId) : undefined,
    subject: replySubject,
    threadId: sentThreadId || undefined,
  };
}

export async function gmailCreateDraft(input: {
  tenantId: string;
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to) {
    throw new Error("to is required.");
  }
  if (!subject) {
    throw new Error("subject is required.");
  }
  if (!body) {
    throw new Error("body is required.");
  }

  const threadId = input.threadId?.trim();
  const draft = await gmailFetch<{
    id?: string;
    message?: { id?: string; threadId?: string; labelIds?: string[] };
  }>(input.accessToken, "/users/me/drafts", {
    body: JSON.stringify({
      message: {
        raw: encodeGmailRawMessage(
          buildPlainTextMimeHeaderLines({
            bcc: input.bcc,
            body,
            cc: input.cc,
            subject,
            to,
          })
        ),
        ...(threadId ? { threadId } : {}),
      },
    }),
    method: "POST",
  });

  const draftId = draft.id?.trim() ?? "";
  const messageId = draft.message?.id?.trim();
  const draftThreadId = draft.message?.threadId?.trim() ?? threadId ?? "";

  return {
    draftId: draftId || undefined,
    link: messageId
      ? gmailDraftComposeLink(messageId)
      : draftThreadId
        ? gmailThreadLink(draftThreadId)
        : undefined,
    messageId: messageId || undefined,
    subject,
    threadId: draftThreadId || undefined,
    to,
  };
}

export async function gmailSendDraft(input: {
  tenantId: string;
  accessToken: string;
  draftId: string;
}) {
  await assertGmailActionAllowed({ tenantId: input.tenantId });

  const draftId = input.draftId.trim();
  if (!draftId) {
    throw new Error("draftId is required.");
  }

  const sent = await gmailFetch<{
    id?: string;
    threadId?: string;
    snippet?: string;
  }>(input.accessToken, "/users/me/drafts/send", {
    body: JSON.stringify({ id: draftId }),
    method: "POST",
  });

  const threadId = sent.threadId?.trim() ?? "";
  return {
    draftId,
    id: sent.id?.trim() || undefined,
    link: threadId ? gmailThreadLink(threadId) : undefined,
    snippet: sent.snippet?.trim() || undefined,
    threadId: threadId || undefined,
  };
}
