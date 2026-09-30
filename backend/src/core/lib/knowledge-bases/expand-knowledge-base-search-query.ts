import type { ChatHistoryMessage } from "@/core/lib/chat/chat-schemas";

const SHORT_QUERY_MAX_CHARS = 80;

const FOLLOW_UP_START_PATTERN =
  /^(?:how many|how much|what about|when did|where|who|which|why|tell me more|more detail|go on|continue|and |also )/i;

export function isLikelyFollowUpQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.length <= SHORT_QUERY_MAX_CHARS) {
    return true;
  }
  return FOLLOW_UP_START_PATTERN.test(trimmed);
}

function recentUserMessages(
  chatHistory: ChatHistoryMessage[],
  maxMessages: number
): string[] {
  return chatHistory
    .filter((message) => message.role === "user")
    .slice(-maxMessages)
    .map((message) => message.content.trim())
    .filter(Boolean);
}

/** Build one or more search queries for hybrid knowledge base retrieval. */
export function buildKnowledgeBaseSearchQueries(args: {
  currentQuery: string;
  chatHistory?: ChatHistoryMessage[];
  maxHistoryUserMessages?: number;
}): string[] {
  const current = args.currentQuery.trim();
  if (!current) {
    return [];
  }

  const queries = new Set<string>([current]);
  const priorUserMessages = recentUserMessages(
    args.chatHistory ?? [],
    args.maxHistoryUserMessages ?? 3
  );

  if (!isLikelyFollowUpQuery(current) || priorUserMessages.length === 0) {
    return [...queries];
  }

  queries.add([...priorUserMessages, current].join(" ").trim());

  const latestUserMessage = priorUserMessages.at(-1);
  if (latestUserMessage && latestUserMessage !== current) {
    queries.add(`${latestUserMessage} ${current}`.trim());
  }

  return [...queries];
}
