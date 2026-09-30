import { listTeamKbItemsForTenant } from "@/core/lib/db/source-queries";
import { searchCalendarFederated } from "@/core/lib/search/federated/calendar";
import { searchGmailFederated } from "@/core/lib/search/federated/gmail";
import { searchJiraFederated } from "@/core/lib/search/federated/jira";
import {
  type HybridLiveSources,
  mergeHybridSearchResults,
} from "@/core/lib/search/federated/merge";
import type { FederatedSourceResult } from "@/core/lib/search/federated/outcome";
import { searchSlackFederated } from "@/core/lib/search/federated/slack";
import { expandKnowledgeSearchQueryForUser } from "@/core/lib/sources/expand-source-search-query";
import {
  expandAllowedKbItemIdsForSearch,
  filterVisibleItemsByAgentKbScope,
  resolveHybridAccessForAgentKbScope,
} from "@/core/lib/sources/source-agent-scope";
import {
  searchIndexedSourcesInSearch,
  searchTeamKbInSearch,
} from "@/core/lib/sources/source-chunk-index";
import { filterVisibleKnowledgeItemsForUser } from "@/core/lib/sources/visibility";
import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";
import {
  buildCitedDocumentsFromResults,
  type CitationMap,
  type CitedDocument,
} from "@/shared/search/citations";
import type {
  InternalSearchStep,
  SearchResultChunk,
} from "@/shared/search/types";

async function resolveExpandedAllowedKbItemIds(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  allowedSourceItemIds: string[];
}) {
  // Unfiltered tenant listing — ACL applied immediately via visibility filter.
  const rawItems = await listTeamKbItemsForTenant({
    limit: 500,
    tenantId: args.tenantId,
  });
  const visibleItems = await filterVisibleKnowledgeItemsForUser({
    items: rawItems,
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  return expandAllowedKbItemIdsForSearch(
    args.allowedSourceItemIds,
    visibleItems
  );
}

export type KbSearchInput = {
  tenantId: string;
  tenantSlug: string;
  authUserId: string;
  userEmail: string;
  userName?: string | null;
  query: string;
  citationStartNumber?: number;
  allowedSourceConnectorTypes?: string[] | null;
  allowedSourceItemIds?: string[] | null;
  /** When set, fan out live Slack/Jira and RRF-merge with KB hits. */
  liveSources?: HybridLiveSources;
};

export type KbSearchOutput = {
  steps: InternalSearchStep[];
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
  error?: string;
};

function kbItemToSearchResult(args: {
  id: string;
  title: string;
  content: string;
  link: string | null;
  sourceType: "personal_source" | "team_source";
  sourceConnectorType?: SearchResultChunk["sourceConnectorType"];
  score: number;
  updatedAt?: string;
}): SearchResultChunk {
  const blurb = args.content.slice(0, 240);
  return {
    blurb,
    chunkIndex: 0,
    content: args.content,
    documentId: args.id,
    link: args.link ? normalizeAtlassianSourceLink(args.link) : "",
    score: args.score,
    sourceConnectorType: args.sourceConnectorType,
    sourceType: args.sourceType,
    title: args.title,
    updatedAt: args.updatedAt,
  };
}

function buildKbSearchOutput(args: {
  query: string;
  results: SearchResultChunk[];
  emptyMessage: string;
  citationStartNumber: number;
  liveErrors?: string[];
}): KbSearchOutput {
  const { documents, citationMap, contextForLlm } =
    buildCitedDocumentsFromResults(args.results, args.citationStartNumber);

  const liveNotes =
    args.liveErrors && args.liveErrors.length > 0
      ? `Live source notes: ${args.liveErrors.join("; ")}`
      : undefined;

  const baseContext = documents.length > 0 ? contextForLlm : args.emptyMessage;
  const withNotes = liveNotes ? `${baseContext}\n\n${liveNotes}` : baseContext;

  return {
    citationMap,
    contextForLlm: withNotes,
    documents,
    steps: [
      { queries: [args.query], type: "queries" },
      { results: args.results, type: "reading" },
      { type: "done" },
    ],
    ...(liveNotes ? { error: liveNotes } : {}),
  };
}

function mapIndexedKbResults(
  indexedResults: SearchResultChunk[]
): SearchResultChunk[] {
  return indexedResults.map((result, index) =>
    kbItemToSearchResult({
      content: result.content,
      id: result.documentId,
      link: result.link,
      score: result.score || 1 - index * 0.01,
      sourceConnectorType: result.sourceConnectorType,
      sourceType: "team_source",
      title: result.title,
      updatedAt: result.updatedAt,
    })
  );
}

async function filterIndexedResultsForAgentScope(args: {
  indexedResults: SearchResultChunk[];
  input: KbSearchInput;
}): Promise<SearchResultChunk[]> {
  const { indexedResults, input } = args;
  const allowedItemIds =
    input.allowedSourceItemIds && input.allowedSourceItemIds.length > 0
      ? new Set(
          await resolveExpandedAllowedKbItemIds({
            allowedSourceItemIds: input.allowedSourceItemIds,
            tenantId: input.tenantId,
            tenantSlug: input.tenantSlug,
            userEmail: input.userEmail,
            userId: input.authUserId,
          })
        )
      : null;
  const allowedSourceTypes =
    !allowedItemIds &&
    input.allowedSourceConnectorTypes &&
    input.allowedSourceConnectorTypes.length > 0
      ? new Set(input.allowedSourceConnectorTypes)
      : null;

  if (allowedItemIds) {
    return filterVisibleItemsByAgentKbScope(
      indexedResults.map((result) => ({
        id: result.documentId,
        result,
      })),
      [...allowedItemIds]
    ).map((item) => item.result);
  }
  if (allowedSourceTypes) {
    return indexedResults.filter((result) =>
      allowedSourceTypes.has(result.sourceConnectorType ?? "manual")
    );
  }
  return indexedResults;
}

export async function runPersonalKbSearch(
  input: KbSearchInput
): Promise<KbSearchOutput> {
  const citationStartNumber = input.citationStartNumber ?? 1;
  const query = expandKnowledgeSearchQueryForUser({
    query: input.query.trim(),
    userEmail: input.userEmail,
    userName: input.userName,
  });

  if (!query) {
    return {
      citationMap: {},
      contextForLlm: "Provide a search query for the personal knowledge base.",
      documents: [],
      steps: [{ type: "done" }],
    };
  }

  // Agent KB allowlists must also gate live hybrid + indexed Slack (otherwise a
  // doc-scoped agent still pulls open connector corpora via sourceSearch).
  const hybridAccess = resolveHybridAccessForAgentKbScope({
    allowedSourceConnectorTypes: input.allowedSourceConnectorTypes,
    allowedSourceItemIds: input.allowedSourceItemIds,
    liveSources: input.liveSources,
  });
  const wantSlack = hybridAccess.liveSources.slack;
  const wantJira = hybridAccess.liveSources.jira;
  const wantGmail = hybridAccess.liveSources.gmail;
  const wantCalendar = hybridAccess.liveSources.calendar;
  const includeIndexedSlack = hybridAccess.includeIndexedSlack;

  const [
    indexedBundle,
    slackBundle,
    jiraOutcome,
    gmailOutcome,
    calendarOutcome,
  ] = await Promise.all([
    searchIndexedSourcesInSearch({
      query,
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      userId: input.authUserId,
    }),
    wantSlack
      ? searchSlackFederated({
          query,
          tenantId: input.tenantId,
          userId: input.authUserId,
        })
      : Promise.resolve({
          dmResults: [] as SearchResultChunk[],
          keywordResults: [] as SearchResultChunk[],
        }),
    wantJira
      ? searchJiraFederated({
          query,
          tenantId: input.tenantId,
          userId: input.authUserId,
        })
      : Promise.resolve<FederatedSourceResult>({ results: [] }),
    wantGmail
      ? searchGmailFederated({
          query,
          tenantId: input.tenantId,
          userEmail: input.userEmail,
          userId: input.authUserId,
        })
      : Promise.resolve<FederatedSourceResult>({ results: [] }),
    wantCalendar
      ? searchCalendarFederated({
          query,
          tenantId: input.tenantId,
          userId: input.authUserId,
        })
      : Promise.resolve<FederatedSourceResult>({ results: [] }),
  ]);

  const filteredIndexed = await filterIndexedResultsForAgentScope({
    indexedResults: indexedBundle.teamKb,
    input,
  });
  const kbResults = mapIndexedKbResults(filteredIndexed);

  const results = mergeHybridSearchResults({
    calendarResults: wantCalendar ? calendarOutcome.results : undefined,
    gmailResults: wantGmail ? gmailOutcome.results : undefined,
    jiraResults: wantJira ? jiraOutcome.results : undefined,
    kbResults,
    query,
    slackDmResults: wantSlack ? slackBundle.dmResults : undefined,
    slackIndexedResults: includeIndexedSlack ? indexedBundle.slack : undefined,
    slackResults: wantSlack ? slackBundle.keywordResults : undefined,
  });

  const liveErrors = [
    "error" in slackBundle ? slackBundle.error : undefined,
    jiraOutcome.error,
    gmailOutcome.error,
    calendarOutcome.error,
  ].filter((value): value is string => Boolean(value));

  const emptyMessage =
    wantSlack || wantJira || wantGmail || wantCalendar
      ? "No sources or connected live apps matched the search."
      : "No sources matched the search.";

  return buildKbSearchOutput({
    citationStartNumber,
    emptyMessage,
    liveErrors,
    query,
    results,
  });
}

export async function runTeamKbSearch(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
  query: string;
  citationStartNumber?: number;
}): Promise<KbSearchOutput> {
  const citationStartNumber = args.citationStartNumber ?? 1;
  const query = expandKnowledgeSearchQueryForUser({
    query: args.query.trim(),
    userEmail: args.userEmail,
    userName: args.userName,
  });

  if (!query) {
    return {
      citationMap: {},
      contextForLlm: "Provide a search query for team sources.",
      documents: [],
      steps: [{ type: "done" }],
    };
  }

  const indexedResults = await searchTeamKbInSearch({
    query,
    tenantId: args.tenantId,
    userEmail: args.userEmail,
    userId: args.userId,
  });

  const results = mapIndexedKbResults(indexedResults);

  return buildKbSearchOutput({
    citationStartNumber,
    emptyMessage: "No team sources matched the search.",
    query,
    results,
  });
}
