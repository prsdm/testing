import type { ModelMessage } from "ai";
import {
  CONTEXT_COMPACTION_THRESHOLD_TOKENS,
  RECENT_MESSAGES_TO_KEEP,
} from "@/shared/ai/context-harness/constants";
import {
  estimateModelMessagesTokens,
  estimateTokensFromText,
} from "@/shared/ai/context-harness/token-estimate";

export const COMPACTION_SUMMARY_PREFIX = "[Previous conversation summary]";

export function splitMessagesForCompaction(
  messages: ModelMessage[],
  recentCount = RECENT_MESSAGES_TO_KEEP
): { older: ModelMessage[]; recent: ModelMessage[] } {
  if (messages.length <= recentCount) {
    return { older: [], recent: messages };
  }
  return {
    older: messages.slice(0, messages.length - recentCount),
    recent: messages.slice(-recentCount),
  };
}

export function formatMessagesForSummary(messages: ModelMessage[]): string {
  return messages
    .map((message, index) => {
      const body =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      return `### Message ${index + 1} (${message.role})\n${body}`;
    })
    .join("\n\n");
}

export function buildCompactionSummaryMessage(summary: string): ModelMessage {
  return {
    content: `${COMPACTION_SUMMARY_PREFIX}\n\n${summary.trim()}\n\nContinue from this summary and the recent messages below.`,
    role: "user",
  };
}

export function shouldCompactModelContext(args: {
  systemText: string;
  messages: ModelMessage[];
  thresholdTokens?: number;
}): boolean {
  const threshold = args.thresholdTokens ?? CONTEXT_COMPACTION_THRESHOLD_TOKENS;
  const total =
    estimateTokensFromText(args.systemText) +
    estimateModelMessagesTokens(args.messages);
  return total > threshold;
}

export type SummarizeConversation = (
  olderMessages: ModelMessage[]
) => Promise<string>;

export async function compactModelMessagesIfNeeded(args: {
  systemText: string;
  messages: ModelMessage[];
  summarize?: SummarizeConversation;
  thresholdTokens?: number;
  recentCount?: number;
}): Promise<ModelMessage[]> {
  if (
    !shouldCompactModelContext({
      messages: args.messages,
      systemText: args.systemText,
      thresholdTokens: args.thresholdTokens,
    })
  ) {
    return args.messages;
  }

  const { older, recent } = splitMessagesForCompaction(
    args.messages,
    args.recentCount
  );
  if (older.length === 0) {
    return args.messages;
  }

  const summarize =
    args.summarize ??
    (async (olderMessages) =>
      formatMessagesForSummary(olderMessages).slice(0, 4000));

  const summary = await summarize(older);
  if (!summary.trim()) {
    return args.messages;
  }

  return [buildCompactionSummaryMessage(summary), ...recent];
}
