/** Rough chars-per-token for English + JSON (no tiktoken dependency). */
export const CHARS_PER_TOKEN_ESTIMATE = 4;

/** Compact when system + messages exceed this budget (TrueForge default). */
export const CONTEXT_COMPACTION_THRESHOLD_TOKENS = 50_000;

/** Max tokens from a single tool result sent back to the model. */
export const MAX_TOOL_RESULT_TOKENS = 6000;

/** Recent messages kept verbatim when compacting older history. */
export const RECENT_MESSAGES_TO_KEEP = 8;

/** Max tokens for each rolling context summary rewrite. */
export const CONTEXT_SUMMARY_MAX_OUTPUT_TOKENS = 4096;

/** Preview chars shown at start/end when truncating tool JSON/text. */
export const TOOL_TRUNCATION_EDGE_CHARS = 100;
