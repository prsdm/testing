import {
  gmailGetMessage,
  gmailSearchMessages,
} from "@/core/lib/connectors/providers/gmail/actions";
import { truncateGmailBody } from "@/core/lib/connectors/providers/gmail/message-utils";
import { ensureFreshGoogleDriveAccessToken } from "@/core/lib/connectors/providers/google-drive/credential-token";
import { getGoogleAppConnectorForTenantUser } from "@/core/lib/connectors/providers/google-shared/queries";
import { FEDERATED_LIVE_LIMIT } from "./constants";
import { gmailFromDisplayName } from "./gmail-title";
import { buildGmailFederatedQuery } from "./live-query";
import { type FederatedSourceResult, federatedErrorMessage } from "./outcome";

const FEDERATED_GMAIL_BODY_MAX = 2000;

function gmailDocumentId(args: {
  id?: string;
  threadId?: string;
  index: number;
}) {
  const id = args.id?.trim();
  if (id) {
    return `gmail:${id}`;
  }
  const threadId = args.threadId?.trim();
  if (threadId) {
    return `gmail:thread:${threadId}:${args.index}`;
  }
  return `gmail:unknown:${args.index}`;
}

function gmailContent(args: {
  subject: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  body?: string;
}) {
  const fromLabel = gmailFromDisplayName(args.from) ?? args.from;
  const body = args.body?.trim();
  const lines = [
    `Subject: ${args.subject}`,
    fromLabel ? `From: ${fromLabel}` : null,
    args.to ? `To: ${args.to}` : null,
    args.date ? `Date: ${args.date}` : null,
    body ? body : args.snippet ? args.snippet : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function parseGmailDate(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

/** Live Gmail search → ranked chunks. Empty on missing credential or API errors. */
export async function searchGmailFederated(args: {
  tenantId: string;
  userId: string;
  userEmail?: string | null;
  query: string;
  limit?: number;
}): Promise<FederatedSourceResult> {
  const query = args.query.trim();
  if (!query) {
    return { results: [] };
  }

  // Owned Gmail only — shared org credentials must not search another mailbox.
  const connector = await getGoogleAppConnectorForTenantUser({
    appId: "gmail",
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connector) {
    return {
      error: "Connect your own Gmail account for live search.",
      results: [],
    };
  }

  try {
    const accessToken = await ensureFreshGoogleDriveAccessToken({
      credentialId: connector.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    const gmailQuery = buildGmailFederatedQuery(query, {
      viewerEmail: args.userEmail,
    });
    const result = await gmailSearchMessages({
      accessToken,
      maxResults: Math.min(
        args.limit ?? FEDERATED_LIVE_LIMIT,
        FEDERATED_LIVE_LIMIT
      ),
      query: gmailQuery,
      tenantId: args.tenantId,
    });

    const bodies = await Promise.all(
      result.messages.map(async (message) => {
        const messageId = message.id?.trim();
        if (!messageId) {
          return;
        }
        try {
          const full = await gmailGetMessage({
            accessToken,
            messageId,
            tenantId: args.tenantId,
          });
          return full.body
            ? truncateGmailBody(full.body, FEDERATED_GMAIL_BODY_MAX)
            : undefined;
        } catch {}
      })
    );

    const results = result.messages.map((message, index) => {
      const subject = message.subject?.trim() || "(no subject)";
      const snippet = message.snippet?.trim() || "";
      const body = bodies[index];
      const fromLabel = gmailFromDisplayName(message.from) ?? message.from;
      const content = gmailContent({
        body,
        date: message.date,
        from: message.from,
        snippet,
        subject,
        to: message.to,
      });
      // Include sender in the title so person-name overlap ranking and UI chips
      // surface Gmail hits (subjects alone often omit the person's name).
      const title = fromLabel?.trim()
        ? `${fromLabel.trim()}: ${subject}`
        : subject;
      return {
        blurb: (snippet || content).slice(0, 240),
        chunkIndex: 0,
        content,
        documentId: gmailDocumentId({
          id: message.id,
          index,
          threadId: message.threadId,
        }),
        link: message.link?.trim() ?? "",
        score: 1 - index * 0.01,
        sourceType: "gmail" as const,
        title,
        updatedAt: parseGmailDate(message.date),
      };
    });

    return { results };
  } catch (error) {
    return {
      error: federatedErrorMessage("Gmail", error),
      results: [],
    };
  }
}
