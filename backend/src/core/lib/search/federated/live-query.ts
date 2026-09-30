import { extractQueryOverlapTokens } from "./query-overlap";

const LIVE_QUERY_NOISE = new Set([
  "conversation",
  "conversations",
  "overall",
  "discuss",
  "discussed",
  "discussion",
  "discussions",
  "history",
  "chat",
  "chats",
  "message",
  "messages",
  "email",
  "emails",
  "mail",
  "gmail",
  "slack",
  "jira",
  "outlook",
  "inbox",
  "thread",
  "threads",
  "talk",
  "talked",
  "speaking",
  "spoke",
  "far",
  "so",
  "yet",
  "still",
  "also",
  "only",
  "had",
  "have",
  "has",
  "been",
  "there",
  "here",
  "between",
  "across",
  "everything",
  "anything",
  "something",
  "someone",
  "person",
  "people",
  "summary",
  "summarize",
  "summarise",
  "update",
  "updates",
  "status",
  "meeting",
  "meetings",
  "calendar",
  "calendars",
  "event",
  "events",
  "schedule",
  "scheduled",
  "appointment",
  "appointments",
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Content tokens for live API queries (drops NL filler like "conversation"). */
export function extractLiveSearchTokens(query: string): string[] {
  return extractQueryOverlapTokens(query).filter(
    (token) => !LIVE_QUERY_NOISE.has(token)
  );
}

function extractEmails(query: string) {
  return [...query.matchAll(EMAIL_PATTERN)].map((match) =>
    match[0].toLowerCase()
  );
}

function emailFragmentTokens(email: string) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const domainLabels = domain.split(".").filter(Boolean);
  return [local, ...domainLabels].filter(Boolean);
}

function stripEmailsFromQuery(query: string) {
  return query.replace(EMAIL_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function pickPersonLikeToken(query: string, tokens: string[]) {
  const hinted = query
    .toLowerCase()
    .match(/\b(?:with|from|to)\s+([\p{L}][\p{L}'-]{1,})/u)?.[1];
  if (hinted && tokens.includes(hinted)) {
    return hinted;
  }

  const nameLike = tokens.filter(
    (token) => token.length >= 3 && /[\p{L}]/u.test(token)
  );
  // Prefer the last name-like token (often the person in "… with Prasad").
  return nameLike.at(-1) ?? tokens.at(0);
}

/**
 * Gmail `q` from a natural-language question.
 * "conversation with Prasad" → `from:prasad OR to:prasad OR prasad`
 *
 * Strips the viewer's own email when the model appends it (e.g. admin@…).
 * Never ANDs several `from:`/`to:` groups — Gmail space means AND.
 */
export function buildGmailFederatedQuery(
  query: string,
  options?: { viewerEmail?: string | null }
): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return trimmed;
  }

  const viewerEmail = options?.viewerEmail?.trim().toLowerCase() || null;
  const emails = extractEmails(trimmed);
  const otherEmails = emails.filter((email) => email !== viewerEmail);
  const viewerFragments = new Set(
    viewerEmail ? emailFragmentTokens(viewerEmail) : []
  );

  const withoutEmails = stripEmailsFromQuery(trimmed);
  const tokens = extractLiveSearchTokens(withoutEmails).filter(
    (token) => !viewerFragments.has(token)
  );

  const personToken = pickPersonLikeToken(withoutEmails, tokens);
  const topicTokens = tokens.filter((token) => token !== personToken);

  const clauses: string[] = [];
  if (personToken) {
    clauses.push(`from:${personToken} OR to:${personToken} OR ${personToken}`);
  }
  for (const email of otherEmails) {
    clauses.push(`from:${email} OR to:${email}`);
  }

  if (clauses.length === 0) {
    return topicTokens.join(" ") || withoutEmails || trimmed;
  }

  if (topicTokens.length === 0) {
    return clauses.length === 1
      ? (clauses.at(0) ?? trimmed)
      : clauses.map((clause) => `(${clause})`).join(" OR ");
  }

  // Person/email match is required; topic words are optional free-text AND.
  const identity =
    clauses.length === 1
      ? (clauses.at(0) ?? "")
      : clauses.map((clause) => `(${clause})`).join(" OR ");
  return `(${identity}) ${topicTokens.join(" ")}`;
}

/** Slack search query: content tokens only, not full NL filler. */
export function buildSlackFederatedQuery(query: string): string {
  const trimmed = query.trim();
  const tokens = extractLiveSearchTokens(stripEmailsFromQuery(trimmed));
  if (tokens.length === 0) {
    return trimmed;
  }
  return tokens.join(" ");
}

/** Google Calendar free-text `q`: content tokens only. */
export function buildCalendarFederatedQuery(query: string): string {
  return buildSlackFederatedQuery(query);
}

/**
 * Person-name tokens from the query (e.g. "prasad") used to open Slack DMs.
 * Caps how many people we resolve per search.
 */
export function slackDmPersonCandidates(
  query: string,
  maxPeople = 2
): string[] {
  return extractLiveSearchTokens(stripEmailsFromQuery(query))
    .filter((token) => token.length >= 3)
    .slice(0, maxPeople);
}
