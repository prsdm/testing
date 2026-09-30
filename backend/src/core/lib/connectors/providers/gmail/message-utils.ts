type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

export type GmailMessagePayload = {
  headers?: GmailHeader[];
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

export function getGmailHeader(
  headers: GmailHeader[] | undefined,
  name: string
) {
  const normalized = name.toLowerCase();
  return (
    headers
      ?.find((header) => header.name?.toLowerCase() === normalized)
      ?.value?.trim() ?? ""
  );
}

export function decodeGmailBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractFromParts(
  parts: GmailMessagePart[],
  mimeType: string
): string | null {
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return decodeGmailBase64Url(part.body.data);
    }
    if (part.parts) {
      const nested = extractFromParts(part.parts, mimeType);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function extractGmailMessageBody(payload: GmailMessagePayload) {
  if (payload.body?.data) {
    return decodeGmailBase64Url(payload.body.data);
  }
  if (payload.parts) {
    const plain = extractFromParts(payload.parts, "text/plain");
    if (plain) {
      return plain;
    }
    const html = extractFromParts(payload.parts, "text/html");
    if (html) {
      return html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return "";
}

export function encodeGmailRawMessage(lines: string[]) {
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

export function buildPlainTextMimeHeaderLines(input: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}) {
  const headerLines = [`To: ${input.to}`, `Subject: ${input.subject}`];
  if (input.cc?.trim()) {
    headerLines.push(`Cc: ${input.cc.trim()}`);
  }
  if (input.bcc?.trim()) {
    headerLines.push(`Bcc: ${input.bcc.trim()}`);
  }
  headerLines.push('Content-Type: text/plain; charset="UTF-8"', "", input.body);
  return headerLines;
}

export function gmailThreadLink(threadId: string) {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}

/** Opens a draft in Gmail compose using the API message id (best-effort). */
export function gmailDraftComposeLink(messageId: string) {
  return `https://mail.google.com/mail/u/0/#inbox?compose=${encodeURIComponent(messageId)}`;
}

export function truncateGmailBody(body: string, maxLength = 10_000) {
  if (body.length <= maxLength) {
    return body;
  }
  return `${body.slice(0, maxLength)}…`;
}
