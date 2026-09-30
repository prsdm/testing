/** Token usage shape from LLM provider responses (Vercel AI SDK compatible). */
export type LanguageModelUsage = {
  inputTokens?:
    | number
    | {
        total?: number;
        noCache?: number;
        cacheRead?: number;
        cacheWrite?: number;
      };
  outputTokens?: number | { total?: number; text?: number; reasoning?: number };
  totalTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
};
