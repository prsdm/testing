import { SlackApiError } from "@/core/lib/connectors/providers/slack/api";
import { ensureFreshSlackAccessToken } from "@/core/lib/connectors/providers/slack/credential-token";
import { slackGetDirectMessageHistory } from "@/core/lib/connectors/providers/slack/get-direct-message-history";
import { slackSearchMessages } from "@/core/lib/connectors/providers/slack/search-messages";
import { getSlackConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import type { SearchResultChunk } from "@/shared/search/types";
import {
  FEDERATED_LIVE_LIMIT,
  FEDERATED_SLACK_DM_HISTORY_LIMIT,
} from "./constants";
import {
  buildSlackFederatedQuery,
  slackDmPersonCandidates,
} from "./live-query";
import {
  type FederatedSlackSourceResult,
  federatedErrorMessage,
} from "./outcome";
import { buildSlackFederatedTitle } from "./slack-title";

function slackDocumentId(args: {
  channelId?: string;
  ts?: string;
  index: number;
}) {
  const channel = args.channelId?.trim() || "unknown";
  const ts = args.ts?.trim() || String(args.index);
  return `slack:${channel}:${ts}`;
}

function slackContent(args: {
  text: string;
  userName?: string;
  title: string;
  participantName?: string;
}) {
  const author = args.userName?.trim();
  const participant = args.participantName?.trim();
  const headerParts = [
    args.title ? `Source: ${args.title}` : null,
    participant ? `Participant: ${participant}` : null,
    author ? `From: ${author}` : null,
  ].filter(Boolean);
  if (headerParts.length === 0) {
    return args.text;
  }
  return `${headerParts.join(" · ")}\n${args.text}`;
}

function mapSearchMessagesToChunks(
  messages: Array<{
    channelId?: string;
    channelName?: string;
    ts?: string;
    text: string;
    userName?: string;
    permalink?: string;
    isIm?: boolean;
    isMpim?: boolean;
  }>
): SearchResultChunk[] {
  return messages.map((message, index) => {
    const text = message.text.trim() || "(empty message)";
    const title = buildSlackFederatedTitle({
      channelName: message.channelName,
      isIm: message.isIm,
      isMpim: message.isMpim,
      text,
      userName: message.userName,
    });
    const content = slackContent({
      text,
      title,
      userName: message.userName,
    });
    return {
      blurb: text.slice(0, 240),
      chunkIndex: 0,
      content,
      documentId: slackDocumentId({
        channelId: message.channelId,
        index,
        ts: message.ts,
      }),
      link: message.permalink?.trim() ?? "",
      score: 1 - index * 0.01,
      sourceType: "slack" as const,
      title,
    };
  });
}

function dedupeSlackChunks(chunks: SearchResultChunk[]): SearchResultChunk[] {
  const seen = new Set<string>();
  const out: SearchResultChunk[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) {
      continue;
    }
    seen.add(chunk.documentId);
    out.push(chunk);
  }
  return out;
}

async function searchSlackKeywordChunks(args: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  query: string;
  limit: number;
}): Promise<SearchResultChunk[]> {
  const result = await slackSearchMessages({
    accessToken: args.accessToken,
    count: args.limit,
    query: args.query,
    sort: "score",
    teamUrl: args.teamUrl,
    tenantId: args.tenantId,
  });
  return mapSearchMessagesToChunks(result.messages);
}

/** Resolve person → DM history → chunks. Empty if no match / errors. */
async function searchSlackDmChunks(args: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  personQuery: string;
  limit: number;
}): Promise<{ results: SearchResultChunk[]; error?: string }> {
  try {
    const result = await slackGetDirectMessageHistory({
      accessToken: args.accessToken,
      limit: args.limit,
      teamUrl: args.teamUrl,
      tenantId: args.tenantId,
      user: args.personQuery,
    });

    const participantName = result.userName?.trim() || args.personQuery;
    return {
      results: result.messages.map((message, index) => {
        const text = message.text.trim() || "(empty message)";
        const title = buildSlackFederatedTitle({
          isIm: true,
          text,
          userName: message.userName || participantName,
        });
        const content = slackContent({
          participantName,
          text,
          title,
          userName: message.userName,
        });
        return {
          blurb: text.slice(0, 240),
          chunkIndex: 0,
          content,
          documentId: slackDocumentId({
            channelId: result.channelId,
            index,
            ts: message.ts,
          }),
          link: message.permalink?.trim() ?? "",
          score: 1 - index * 0.01,
          sourceType: "slack" as const,
          title,
        };
      }),
    };
  } catch (error) {
    return {
      error: federatedErrorMessage("Slack", error),
      results: [],
    };
  }
}

/**
 * Live Slack → keyword search + person DM history + in:@person search.
 * Ranking stays in RRF + overlap merge.
 */
export async function searchSlackFederated(args: {
  tenantId: string;
  userId: string;
  query: string;
  limit?: number;
}): Promise<FederatedSlackSourceResult> {
  const empty: FederatedSlackSourceResult = {
    dmResults: [],
    keywordResults: [],
  };
  const query = args.query.trim();
  if (!query) {
    return empty;
  }

  const connector = await getSlackConnectorForTenantUser({
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connector) {
    return {
      ...empty,
      error: "Connect your own Slack account for live search.",
    };
  }

  try {
    let token = await ensureFreshSlackAccessToken({
      credentialId: connector.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    const limit = Math.min(
      args.limit ?? FEDERATED_LIVE_LIMIT,
      FEDERATED_LIVE_LIMIT
    );
    const dmLimit = FEDERATED_SLACK_DM_HISTORY_LIMIT;
    const people = slackDmPersonCandidates(query);
    const keywordQuery = buildSlackFederatedQuery(query);
    // Person DMs rarely contain the person's name — also search in:@name.
    const personDmQueries = people.map((person) => `in:@${person}`);

    const runSearch = async (accessToken: string, teamUrl: string | null) => {
      const [primaryKeyword, ...rest] = await Promise.all([
        searchSlackKeywordChunks({
          accessToken,
          limit,
          query: keywordQuery,
          teamUrl,
          tenantId: args.tenantId,
        }),
        ...personDmQueries.map((personQuery) =>
          searchSlackKeywordChunks({
            accessToken,
            limit,
            query: personQuery,
            teamUrl,
            tenantId: args.tenantId,
          }).catch(() => [] as SearchResultChunk[])
        ),
        ...people.map((personQuery) =>
          searchSlackDmChunks({
            accessToken,
            limit: dmLimit,
            personQuery,
            teamUrl,
            tenantId: args.tenantId,
          })
        ),
      ]);

      const personSearchCount = personDmQueries.length;
      const personKeywordLists = rest.slice(
        0,
        personSearchCount
      ) as SearchResultChunk[][];
      const dmOutcomes = rest.slice(personSearchCount) as Array<{
        results: SearchResultChunk[];
        error?: string;
      }>;

      return {
        dmOutcomes,
        keywordResults: dedupeSlackChunks([
          ...primaryKeyword,
          ...personKeywordLists.flat(),
        ]),
      };
    };

    let keywordResults: SearchResultChunk[];
    let dmOutcomes: Array<{ results: SearchResultChunk[]; error?: string }>;
    try {
      ({ keywordResults, dmOutcomes } = await runSearch(
        token.accessToken,
        token.teamUrl
      ));
    } catch (error) {
      if (
        !(error instanceof SlackApiError) ||
        (error.code !== "token_expired" && error.code !== "invalid_auth")
      ) {
        throw error;
      }
      token = await ensureFreshSlackAccessToken({
        credentialId: connector.credentialId,
        forceRefresh: true,
        tenantId: args.tenantId,
        userId: args.userId,
      });
      ({ keywordResults, dmOutcomes } = await runSearch(
        token.accessToken,
        token.teamUrl
      ));
    }

    const keywordIds = new Set(keywordResults.map((chunk) => chunk.documentId));
    const seen = new Set<string>();
    const dmResults: SearchResultChunk[] = [];
    let dmError: string | undefined;
    for (const outcome of dmOutcomes) {
      if (outcome.error && !dmError) {
        dmError = outcome.error;
      }
      for (const chunk of outcome.results) {
        if (keywordIds.has(chunk.documentId) || seen.has(chunk.documentId)) {
          continue;
        }
        seen.add(chunk.documentId);
        dmResults.push(chunk);
      }
    }

    return {
      dmResults,
      keywordResults,
      ...(dmError ? { error: dmError } : {}),
    };
  } catch (error) {
    return {
      ...empty,
      error: federatedErrorMessage("Slack", error),
    };
  }
}
