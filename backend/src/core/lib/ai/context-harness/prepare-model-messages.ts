import {
  generateText,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { convertChatUiMessagesForModel } from "@/core/lib/ai/convert-chat-ui-messages";
import { getLanguageModel } from "@/core/lib/ai/providers";
import type { ResolvedTenantLlmKeys } from "@/core/lib/db/llm-provider-queries";
import {
  CONTEXT_SUMMARY_MAX_OUTPUT_TOKENS,
  RECENT_MESSAGES_TO_KEEP,
} from "@/shared/ai/context-harness/constants";
import { truncateToolResultsInModelMessages } from "@/shared/ai/context-harness/truncate-tool-results";
import {
  buildCompactionSummaryMessage,
  formatMessagesForSummary,
  shouldCompactModelContext,
} from "./compact-model-messages";
import {
  activeUiMessagesAfterSummary,
  type ChatContextSummaryState,
  isPersistedSummaryValid,
  resolveSummaryThroughMessageId,
  splitUiMessagesForCompaction,
} from "./rolling-summary";

export type PrepareModelMessagesResult = {
  messages: ModelMessage[];
  summaryUpdated: ChatContextSummaryState | null;
  didSummarize: boolean;
};

async function uiMessagesToSummaryText(
  uiMessages: UIMessage[],
  modelId: string,
  tools?: ToolSet
): Promise<string> {
  if (uiMessages.length === 0) {
    return "";
  }
  const modelMessages = await convertChatUiMessagesForModel({
    modelId,
    tools,
    uiMessages,
  });
  return formatMessagesForSummary(modelMessages);
}

async function summarizeRollingContext(args: {
  existingSummary: string | null;
  messagesText: string;
  modelId: string;
  llmKeys: ResolvedTenantLlmKeys;
}): Promise<string> {
  if (!args.messagesText.trim()) {
    return args.existingSummary?.trim() ?? "";
  }

  const prompt = args.existingSummary?.trim()
    ? `Existing conversation summary:\n${args.existingSummary.trim()}\n\nIncorporate these additional messages into one updated summary:\n${args.messagesText}`
    : `Summarize the following earlier messages:\n${args.messagesText}`;

  const { text } = await generateText({
    maxOutputTokens: CONTEXT_SUMMARY_MAX_OUTPUT_TOKENS,
    model: getLanguageModel(args.modelId, args.llmKeys),
    prompt,
    system:
      "You compress chat history into a factual brief for another agent turn. Preserve goals, decisions, tool findings, and open tasks. Output plain text only.",
  });
  return text.trim();
}

export async function prepareModelMessagesForTurn(args: {
  uiMessages: UIMessage[];
  persistedSummary: ChatContextSummaryState | null;
  systemText: string;
  modelId: string;
  llmKeys: ResolvedTenantLlmKeys;
  tools?: ToolSet;
  continuationAssistantMessageId?: string;
}): Promise<PrepareModelMessagesResult> {
  const persistedSummary = isPersistedSummaryValid({
    persistedSummary: args.persistedSummary,
    uiMessages: args.uiMessages,
  })
    ? args.persistedSummary
    : null;

  const activeUiMessages = activeUiMessagesAfterSummary({
    persistedSummary,
    uiMessages: args.uiMessages,
  });

  let modelMessages = await convertChatUiMessagesForModel({
    continuationAssistantMessageId: args.continuationAssistantMessageId,
    modelId: args.modelId,
    tools: args.tools,
    uiMessages: activeUiMessages,
  });

  if (persistedSummary) {
    modelMessages = [
      buildCompactionSummaryMessage(persistedSummary.summary),
      ...modelMessages,
    ];
  }

  modelMessages = truncateToolResultsInModelMessages(modelMessages);

  if (
    !shouldCompactModelContext({
      messages: modelMessages,
      systemText: args.systemText,
    })
  ) {
    return {
      didSummarize: false,
      messages: modelMessages,
      summaryUpdated: null,
    };
  }

  const compactionSource =
    persistedSummary === null ? args.uiMessages : activeUiMessages;
  const { older: olderUi, recent: recentUi } = splitUiMessagesForCompaction(
    compactionSource,
    RECENT_MESSAGES_TO_KEEP
  );

  if (olderUi.length === 0) {
    return {
      didSummarize: false,
      messages: modelMessages,
      summaryUpdated: null,
    };
  }

  const messagesText = await uiMessagesToSummaryText(
    olderUi,
    args.modelId,
    args.tools
  );
  const summary = await summarizeRollingContext({
    existingSummary: persistedSummary?.summary ?? null,
    llmKeys: args.llmKeys,
    messagesText,
    modelId: args.modelId,
  });

  if (!summary) {
    return {
      didSummarize: false,
      messages: modelMessages,
      summaryUpdated: null,
    };
  }

  const throughMessageId = resolveSummaryThroughMessageId({
    foldedUiMessages: olderUi,
    persistedSummary,
    uiMessages: args.uiMessages,
  });
  if (!throughMessageId) {
    return {
      didSummarize: false,
      messages: modelMessages,
      summaryUpdated: null,
    };
  }

  const recentModelMessages = truncateToolResultsInModelMessages(
    await convertChatUiMessagesForModel({
      continuationAssistantMessageId: args.continuationAssistantMessageId,
      modelId: args.modelId,
      tools: args.tools,
      uiMessages: recentUi,
    })
  );

  return {
    didSummarize: true,
    messages: [buildCompactionSummaryMessage(summary), ...recentModelMessages],
    summaryUpdated: {
      summary,
      throughMessageId,
      updatedAt: new Date().toISOString(),
    },
  };
}
