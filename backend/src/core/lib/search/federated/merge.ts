import { weightedReciprocalRankFusion } from "@/core/lib/search/rrf";
import type { SearchResultChunk } from "@/shared/search/types";
import {
  FEDERATED_CALENDAR_WEIGHT,
  FEDERATED_GMAIL_WEIGHT,
  FEDERATED_JIRA_WEIGHT,
  FEDERATED_KB_WEIGHT,
  FEDERATED_MERGED_LIMIT,
  FEDERATED_MIN_PER_SOURCE,
  FEDERATED_SLACK_DM_WEIGHT,
  FEDERATED_SLACK_WEIGHT,
} from "./constants";
import { rerankByQueryOverlap } from "./query-overlap";

export type HybridLiveSources = {
  slack?: boolean;
  jira?: boolean;
  gmail?: boolean;
  calendar?: boolean;
};

function withPositionalScores(
  results: SearchResultChunk[]
): SearchResultChunk[] {
  return results.map((result, index) => ({
    ...result,
    score: 1 - index * 0.01,
  }));
}

/**
 * Keep fusion order, but reserve a few slots per sourceType so one loud
 * connector (e.g. Gmail) cannot fill the entire merged window.
 */
export function diversifyMergedResultsBySource(
  results: SearchResultChunk[],
  limit: number,
  minPerSource = FEDERATED_MIN_PER_SOURCE
): SearchResultChunk[] {
  if (results.length <= limit || minPerSource <= 0) {
    return results.slice(0, limit);
  }

  const order = new Map(
    results.map((result, index) => [result.documentId, index] as const)
  );
  const bySource = new Map<string, SearchResultChunk[]>();
  for (const result of results) {
    const existing = bySource.get(result.sourceType);
    if (existing) {
      existing.push(result);
    } else {
      bySource.set(result.sourceType, [result]);
    }
  }

  const picked: SearchResultChunk[] = [];
  const pickedIds = new Set<string>();

  for (const items of bySource.values()) {
    for (const item of items.slice(0, minPerSource)) {
      if (pickedIds.has(item.documentId)) {
        continue;
      }
      picked.push(item);
      pickedIds.add(item.documentId);
    }
  }

  for (const item of results) {
    if (picked.length >= limit) {
      break;
    }
    if (pickedIds.has(item.documentId)) {
      continue;
    }
    picked.push(item);
    pickedIds.add(item.documentId);
  }

  picked.sort(
    (left, right) =>
      (order.get(left.documentId) ?? 0) - (order.get(right.documentId) ?? 0)
  );
  return picked.slice(0, limit);
}

/**
 * Merge KB + optional live ranked lists with weighted RRF, then re-check the
 * FULL candidate pool against the query (token overlap) before capping.
 * Slack keyword search and Slack DM history are separate equal-weight lists.
 */
export function mergeHybridSearchResults(args: {
  query?: string;
  kbResults: SearchResultChunk[];
  /** Indexed Slack corpus (Vespa). Same weight as live keyword Slack. */
  slackIndexedResults?: SearchResultChunk[];
  slackResults?: SearchResultChunk[];
  slackDmResults?: SearchResultChunk[];
  jiraResults?: SearchResultChunk[];
  gmailResults?: SearchResultChunk[];
  calendarResults?: SearchResultChunk[];
  limit?: number;
}): SearchResultChunk[] {
  const limit = args.limit ?? FEDERATED_MERGED_LIMIT;
  const rankedResults: SearchResultChunk[][] = [];
  const weights: number[] = [];

  if (args.kbResults.length > 0) {
    rankedResults.push(args.kbResults);
    weights.push(FEDERATED_KB_WEIGHT);
  }
  // Live keyword first so RRF keeps fresher text when the same documentId hits both.
  if (args.slackResults && args.slackResults.length > 0) {
    rankedResults.push(args.slackResults);
    weights.push(FEDERATED_SLACK_WEIGHT);
  }
  if (args.slackIndexedResults && args.slackIndexedResults.length > 0) {
    rankedResults.push(args.slackIndexedResults);
    weights.push(FEDERATED_SLACK_WEIGHT);
  }
  if (args.slackDmResults && args.slackDmResults.length > 0) {
    rankedResults.push(args.slackDmResults);
    weights.push(FEDERATED_SLACK_DM_WEIGHT);
  }
  if (args.jiraResults && args.jiraResults.length > 0) {
    rankedResults.push(args.jiraResults);
    weights.push(FEDERATED_JIRA_WEIGHT);
  }
  if (args.gmailResults && args.gmailResults.length > 0) {
    rankedResults.push(args.gmailResults);
    weights.push(FEDERATED_GMAIL_WEIGHT);
  }
  if (args.calendarResults && args.calendarResults.length > 0) {
    rankedResults.push(args.calendarResults);
    weights.push(FEDERATED_CALENDAR_WEIGHT);
  }

  if (rankedResults.length === 0) {
    return [];
  }

  const fused =
    rankedResults.length === 1
      ? (rankedResults.at(0) ?? [])
      : weightedReciprocalRankFusion({
          idExtractor: (item) => item.documentId,
          rankedResults,
          weights,
        });

  const reranked = args.query?.trim()
    ? rerankByQueryOverlap({ query: args.query, results: fused })
    : fused;

  return withPositionalScores(diversifyMergedResultsBySource(reranked, limit));
}
