import { extractLiveSearchTokens } from "./live-query";

/** Escape a free-text query for Jira `text ~ "..."` JQL. */
export function buildJiraTextSearchJql(query: string): string {
  const tokens = extractLiveSearchTokens(query);
  const text = (tokens.length > 0 ? tokens.join(" ") : query).trim();
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `text ~ "${escaped}" ORDER BY updated DESC`;
}
