import {
  CHARS_PER_TOKEN_ESTIMATE,
  MAX_TOOL_RESULT_TOKENS,
  TOOL_TRUNCATION_EDGE_CHARS,
} from "./constants";
import { estimateTokensFromText } from "./token-estimate";

export function maxCharsForToolResultTokens(
  maxTokens = MAX_TOOL_RESULT_TOKENS
): number {
  return maxTokens * CHARS_PER_TOKEN_ESTIMATE;
}

/** Truncate model-facing tool text while keeping head/tail preview. */
export function truncateContextForLlm(
  text: string,
  maxTokens = MAX_TOOL_RESULT_TOKENS
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  const maxChars = maxCharsForToolResultTokens(maxTokens);
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const edge = TOOL_TRUNCATION_EDGE_CHARS;
  const head = trimmed.slice(0, edge);
  const tail = trimmed.slice(-edge);
  const removedChars = trimmed.length - head.length - tail.length;
  const removedTokens = Math.max(
    0,
    estimateTokensFromText(String(removedChars)) - 1
  );
  return `${head}\n… [truncated ~${removedTokens} tokens; full result is stored in chat history] …\n${tail}`;
}
