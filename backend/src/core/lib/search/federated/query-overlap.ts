import type { SearchResultChunk } from "@/shared/search/types";

const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "them",
  "their",
  "this",
  "that",
  "these",
  "those",
  "what",
  "who",
  "whom",
  "which",
  "when",
  "where",
  "why",
  "how",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "just",
  "about",
  "with",
  "from",
  "into",
  "onto",
  "for",
  "of",
  "on",
  "in",
  "at",
  "to",
  "and",
  "or",
  "but",
  "if",
  "then",
  "so",
  "as",
  "by",
  "please",
  "tell",
  "show",
  "find",
  "get",
  "list",
  "give",
  "need",
  "want",
  "know",
  "any",
  "all",
  "some",
  "current",
  "latest",
  "conversation",
  "conversations",
  "overall",
  "discuss",
  "discussed",
  "discussion",
  "history",
  "chat",
  "message",
  "messages",
  "email",
  "emails",
  "mail",
  "far",
  "had",
  "have",
  "has",
]);

export function tokenizeSearchText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

/** Content-bearing query tokens used for overlap rerank. */
export function extractQueryOverlapTokens(query: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of tokenizeSearchText(query)) {
    if (QUERY_STOPWORDS.has(token) || seen.has(token)) {
      continue;
    }
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/**
 * 0–1 overlap of query tokens against title (weighted 2x) and body.
 * Title hits matter more so "Shubham Task" beats a weak Drive match.
 */
export function documentQueryOverlap(
  queryTokens: string[],
  document: Pick<SearchResultChunk, "title" | "blurb" | "content">
): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const titleTokens = new Set(tokenizeSearchText(document.title));
  const bodyTokens = new Set(
    tokenizeSearchText(
      `${document.blurb ?? ""} ${document.content.slice(0, 1500)}`
    )
  );

  let score = 0;
  const maxScore = queryTokens.length * 2;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      score += 2;
    } else if (bodyTokens.has(token)) {
      score += 1;
    }
  }

  return score / maxScore;
}

/**
 * Re-check merged hits against the query. Docs that share query terms rise;
 * zero-overlap noise (e.g. unrelated Drive docs) sinks. Keeps original order
 * when nothing overlaps.
 */
export function rerankByQueryOverlap(args: {
  query: string;
  results: SearchResultChunk[];
}): SearchResultChunk[] {
  if (args.results.length <= 1) {
    return args.results;
  }

  const queryTokens = extractQueryOverlapTokens(args.query);
  if (queryTokens.length === 0) {
    return args.results;
  }

  const scored = args.results.map((result, index) => ({
    index,
    overlap: documentQueryOverlap(queryTokens, result),
    result,
  }));

  const maxOverlap = Math.max(...scored.map((item) => item.overlap));
  if (maxOverlap <= 0) {
    return args.results;
  }

  scored.sort((left, right) => {
    if (right.overlap !== left.overlap) {
      return right.overlap - left.overlap;
    }
    return left.index - right.index;
  });

  return scored.map((item, index) => ({
    ...item.result,
    score: 1 - index * 0.01,
  }));
}
