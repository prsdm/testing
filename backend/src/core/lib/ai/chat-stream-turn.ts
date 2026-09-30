import {
  isStepCount,
  type LanguageModelUsage,
  readUIMessageStream,
  streamText,
  type UIMessage,
} from "ai";
import { buildChatInstructions } from "@/core/lib/ai/chat-instructions";
import { buildChatTools } from "@/core/lib/ai/chat-tools";
import type { ChatWorkflowInput } from "@/core/lib/ai/chat-workflow-types";
import { prepareModelMessagesForTurn } from "@/core/lib/ai/context-harness/prepare-model-messages";
import { chatContextSummaryFromRow } from "@/core/lib/ai/context-harness/rolling-summary";
import type { convertChatUiMessagesForModel } from "@/core/lib/ai/convert-chat-ui-messages";
import { getLanguageModel } from "@/core/lib/ai/providers";
import { resolveChatReasoningOptions } from "@/core/lib/ai/resolve-reasoning-options";
import { startRoomAssistantStreamSync } from "@/core/lib/ai/room-assistant-stream-sync";
import {
  createSerialWriteStepTracker,
  createSerialWriteToolApproval,
} from "@/core/lib/ai/serial-write-tools";
import { recordStreamTextUsage } from "@/core/lib/billing/record-stream-usage";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import { notifyChatRoomMessagesChanged } from "@/core/lib/chat/chat-room-bus";
import {
  clearChatArtifactStream,
  clearChatRunAbort,
  registerChatRunAbort,
} from "@/core/lib/chat/chat-run-registry";
import {
  getChatById,
  getMessageById,
  updateAssistantWorkflowRunMetadata,
  updateChatContextSummary,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantId,
} from "@/core/lib/db/queries";
import { retryOnPostgresDeadlock } from "@/core/lib/db/retry-on-deadlock";
import type { DBMessage } from "@/core/lib/db/schema";
import { CHAT_AGENT_MAX_STEPS } from "@/shared/ai/chat-agent-budget";
import { persistedTodoNudgeMetadata } from "@/shared/ai/chat-agent-nudge";
import {
  assistantPartsHaveTodoPlan,
  createChatPrepareStep,
  latestUserMessageText,
} from "@/shared/ai/chat-task-planning";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import { assistantTurnNeedsContinuation } from "@/shared/chat/assistant-turn-continuation";
import {
  pendingToolApprovalFromParts,
  uiPartsToChatParts,
} from "@/shared/chat/ui-message-parts";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import { formatConnectorFocusInstructions } from "@/shared/connectors/composer-connector-focuses";
import type { MessageMetadata } from "@/shared/types";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

function runStatusFromParts(args: {
  parts: ReturnType<typeof normalizeChatMessageParts>;
  finishReason?: string;
  isAborted: boolean;
  todoExecutionNudged?: boolean;
  todoPendingStepsNudged?: boolean;
}) {
  if (args.isAborted) {
    return "cancelled" as const;
  }
  if (args.finishReason === "error") {
    return "failed" as const;
  }
  if (pendingToolApprovalFromParts(args.parts)) {
    return "suspended" as const;
  }
  if (
    assistantTurnNeedsContinuation(args.parts, {
      todoExecutionNudged: args.todoExecutionNudged,
      todoPendingStepsNudged: args.todoPendingStepsNudged,
    })
  ) {
    return "running" as const;
  }
  return "success" as const;
}

async function markAssistantTurnFailed(args: {
  input: ChatWorkflowInput;
  workflowRunId: string;
}) {
  const [existingMessage] = await getMessageById({
    id: args.input.assistantMessageId,
  });
  const existingMetadata =
    existingMessage?.metadata && typeof existingMessage.metadata === "object"
      ? (existingMessage.metadata as MessageMetadata)
      : {};

  await retryOnPostgresDeadlock(async () => {
    await updateChatWorkflowRunStatus({
      status: "failed",
      workflowRunId: args.workflowRunId,
    });
    await updateMessage({
      id: args.input.assistantMessageId,
      metadata: {
        ...existingMetadata,
        agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
        modelId: args.input.modelId,
        pendingToolApproval: undefined,
        workflowRunId: args.workflowRunId,
        workflowRunStatus: "failed",
      },
      parts:
        (existingMessage?.parts as DBMessage["parts"] | undefined) ??
        ([{ text: "", type: "text" }] as DBMessage["parts"]),
    });
  });
}

async function persistAssistantTurn(args: {
  input: ChatWorkflowInput;
  workflowRunId: string;
  responseMessage: UIMessage;
  finishReason?: string;
  isAborted: boolean;
  totalUsage?: LanguageModelUsage;
  assistantMessageMetadata?: MessageMetadata;
}) {
  const parts = normalizeChatMessageParts(
    uiPartsToChatParts(args.responseMessage.parts)
  );
  const pendingToolApproval = pendingToolApprovalFromParts(parts);
  const [existingMessage] = await getMessageById({
    id: args.input.assistantMessageId,
  });
  const existingMetadata =
    existingMessage?.metadata && typeof existingMessage.metadata === "object"
      ? (existingMessage.metadata as MessageMetadata)
      : {};
  const persistedNudgeMetadata = persistedTodoNudgeMetadata({
    attempted: args.assistantMessageMetadata ?? {},
    finishReason: args.finishReason,
    isAborted: args.isAborted,
  });
  const effectiveMetadata = {
    ...existingMetadata,
    ...persistedNudgeMetadata,
  };
  const workflowRunStatus = runStatusFromParts({
    finishReason: args.finishReason,
    isAborted: args.isAborted,
    parts,
    todoExecutionNudged: effectiveMetadata.todoExecutionNudged,
    todoPendingStepsNudged: effectiveMetadata.todoPendingStepsNudged,
  });

  const metadata: MessageMetadata = {
    ...effectiveMetadata,
    agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
    createdAt: new Date().toISOString(),
    modelId: args.input.modelId,
    pendingToolApproval,
    workflowRunId: args.workflowRunId,
    workflowRunStatus,
  };

  await retryOnPostgresDeadlock(async () => {
    await updateChatWorkflowRunStatus({
      status: workflowRunStatus,
      workflowRunId: args.workflowRunId,
    });
    await updateMessage({
      id: args.input.assistantMessageId,
      metadata,
      parts: parts as DBMessage["parts"],
    });
  });
  await recordStreamTextUsage({
    authUserId: args.input.authUser.id,
    chatId: args.input.chatId,
    modelId: args.input.modelId,
    source: "chat",
    tenantId: args.input.tenantId,
    toolParts: parts,
    totalUsage: args.totalUsage,
  });

  const chat = await getChatById({ id: args.input.chatId });
  if (chat && isRoomChat(chat)) {
    notifyChatRoomMessagesChanged({
      chatId: args.input.chatId,
      threadRootMessageId: existingMessage?.threadRootMessageId ?? null,
    });
  }
}

export type ChatStreamTurnArgs = {
  input: ChatWorkflowInput;
  workflowRunId: string;
  assistantMessageId: string;
  uiMessages: UIMessage[];
  modelMessages?: Awaited<ReturnType<typeof convertChatUiMessagesForModel>>;
  firstByteSpan?: { end: () => void };
  executedToolPartSync?: string;
  isContinuationTurn?: boolean;
  assistantMessageMetadata?: MessageMetadata;
};

type ChatStreamFinishEvent = {
  responseMessage: UIMessage;
  finishReason?: string;
  isAborted: boolean;
};

async function buildChatStreamTextResult(args: ChatStreamTurnArgs) {
  const abortSignal = registerChatRunAbort(args.workflowRunId);
  const { tools, activeToolNames, toolsContext } = buildChatTools({
    configuration: args.input.toolConfiguration,
    input: args.input,
    workflowRunId: args.workflowRunId,
  });
  const { providerOptions } = resolveChatReasoningOptions({
    modelId: args.input.modelId,
    reasoningEffort: args.input.reasoningEffort,
  });

  const systemText = buildChatInstructions({
    connectorFocusInstruction: formatConnectorFocusInstructions(
      args.input.connectorFocuses?.length
        ? args.input.connectorFocuses
        : args.input.connectorFocus
          ? [args.input.connectorFocus]
          : []
    ),
    preferredName: args.input.authUser.preferredName,
    roomKimiroContext: args.input.roomKimiroContext,
    userEmail: args.input.authUser.email,
    userName: args.input.authUser.name,
    workspacePrompt: args.input.workspacePrompt,
  });

  const threadScopedRoomTurn = Boolean(
    args.input.roomHistoryThreadRootMessageId
  );
  const chatRow = await withTenantId(args.input.tenantId, () =>
    getChatById({ id: args.input.chatId })
  );
  const prepared = await prepareModelMessagesForTurn({
    continuationAssistantMessageId: args.isContinuationTurn
      ? args.assistantMessageId
      : undefined,
    llmKeys: args.input.llmKeys,
    modelId: args.input.modelId,
    persistedSummary:
      chatRow && !threadScopedRoomTurn
        ? chatContextSummaryFromRow(chatRow)
        : null,
    systemText,
    tools,
    uiMessages: args.uiMessages,
  });

  if (prepared.summaryUpdated && !threadScopedRoomTurn) {
    const summaryUpdated = prepared.summaryUpdated;
    await withTenantId(args.input.tenantId, () =>
      updateChatContextSummary({
        chatId: args.input.chatId,
        summary: summaryUpdated.summary,
        throughMessageId: summaryUpdated.throughMessageId,
      })
    );
  }

  const preparedMessages = prepared.messages;

  const userMessageText = latestUserMessageText(args.input.messages);
  const currentAssistantParts = normalizeChatMessageParts(
    uiPartsToChatParts(
      args.uiMessages.find((message) => message.id === args.assistantMessageId)
        ?.parts ?? []
    )
  );

  const existingMetadata = args.assistantMessageMetadata ?? {};
  const serialWriteTracker = createSerialWriteStepTracker();

  const result = streamText({
    abortSignal,
    activeTools: activeToolNames,
    messages: preparedMessages,
    model: getLanguageModel(args.input.modelId, args.input.llmKeys),
    prepareStep: createChatPrepareStep({
      assistantParts: currentAssistantParts,
      assistantPartsHaveTodoPlan: assistantPartsHaveTodoPlan(
        currentAssistantParts
      ),
      isContinuationTurn: args.isContinuationTurn === true,
      onStepStart: () => serialWriteTracker.resetForStep(),
      todoExecutionNudged: existingMetadata.todoExecutionNudged,
      todoPendingStepsNudged: existingMetadata.todoPendingStepsNudged,
      userMessageText,
    }) as never,
    providerOptions,
    stopWhen: isStepCount(CHAT_AGENT_MAX_STEPS),
    system: systemText,
    toolApproval: createSerialWriteToolApproval({
      tracker: serialWriteTracker,
      userRejectedApprovalAttempts:
        args.input.userRejectedApprovalAttempts ?? [],
    }) as never,
    tools,
    toolsContext: toolsContext as never,
  });

  return { args, result };
}

async function finishChatStreamTurn(
  ctx: Awaited<ReturnType<typeof buildChatStreamTextResult>>,
  event: ChatStreamFinishEvent
) {
  ctx.args.firstByteSpan?.end();
  try {
    await withTenantId(ctx.args.input.tenantId, async () => {
      await persistAssistantTurn({
        assistantMessageMetadata: ctx.args.assistantMessageMetadata,
        finishReason: event.finishReason,
        input: ctx.args.input,
        isAborted: event.isAborted,
        responseMessage: event.responseMessage,
        totalUsage: await ctx.result.totalUsage,
        workflowRunId: ctx.args.workflowRunId,
      });
    });
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    console.error("[chat-stream-turn] failed to persist assistant turn", {
      assistantMessageId: ctx.args.input.assistantMessageId,
      chatId: ctx.args.input.chatId,
      error,
      workflowRunId: ctx.args.workflowRunId,
    });
    try {
      await withTenantId(ctx.args.input.tenantId, () =>
        markAssistantTurnFailed({
          input: ctx.args.input,
          workflowRunId: ctx.args.workflowRunId,
        })
      );
    } catch (markFailedError) {
      console.error("[chat-stream-turn] failed to mark assistant turn failed", {
        assistantMessageId: ctx.args.input.assistantMessageId,
        chatId: ctx.args.input.chatId,
        error: markFailedError,
        workflowRunId: ctx.args.workflowRunId,
      });
    }
  } finally {
    clearChatRunAbort(ctx.args.workflowRunId);
    clearChatArtifactStream(ctx.args.workflowRunId);
  }
}

function createChatStreamResponseFromContext(
  ctx: Awaited<ReturnType<typeof buildChatStreamTextResult>>,
  hooks?: {
    onFinish?: (event: ChatStreamFinishEvent) => Promise<void>;
    onError?: () => void;
  }
) {
  startRoomAssistantStreamSync({
    abortSignal: registerChatRunAbort(ctx.args.workflowRunId),
    assistantMessageId: ctx.args.assistantMessageId,
    input: ctx.args.input,
    uiMessageStream: readUIMessageStream({
      message: {
        id: ctx.args.assistantMessageId,
        parts: [],
        role: "assistant",
      },
      stream: ctx.result.toUIMessageStream({
        generateMessageId: () => ctx.args.assistantMessageId,
        originalMessages: ctx.args.uiMessages,
      }),
    }),
    workflowRunId: ctx.args.workflowRunId,
  });

  return ctx.result.toUIMessageStreamResponse({
    generateMessageId: () => ctx.args.assistantMessageId,
    headers: {
      "x-assistant-message-id": ctx.args.assistantMessageId,
      "x-workflow-run-id": ctx.args.workflowRunId,
      ...(ctx.args.executedToolPartSync
        ? { "x-executed-tool-sync": ctx.args.executedToolPartSync }
        : {}),
    },
    onError: () => {
      ctx.args.firstByteSpan?.end();
      clearChatRunAbort(ctx.args.workflowRunId);
      hooks?.onError?.();
      return "An error occurred.";
    },
    onFinish: async (event) => {
      await finishChatStreamTurn(ctx, event);
      await hooks?.onFinish?.(event);
    },
    originalMessages: ctx.args.uiMessages,
  });
}

export async function createChatStreamResponse(args: ChatStreamTurnArgs) {
  const ctx = await buildChatStreamTextResult(args);
  return createChatStreamResponseFromContext(ctx);
}

function assistantPartsHaveVisibleText(
  parts: ReturnType<typeof uiPartsToChatParts>
) {
  return parts.some(
    (part) =>
      (part.type === "text" || part.type === "reasoning") &&
      Boolean(part.text?.trim())
  );
}

async function ensureHeadlessAssistantTurnText(
  ctx: Awaited<ReturnType<typeof buildChatStreamTextResult>>,
  args: ChatStreamTurnArgs,
  consumedMessage?: UIMessage
) {
  const [existingMessage] = await withTenantId(args.input.tenantId, () =>
    getMessageById({ id: args.assistantMessageId })
  );
  const existingParts = normalizeChatMessageParts(
    uiPartsToChatParts(
      (existingMessage?.parts as UIMessage["parts"] | undefined) ?? []
    )
  );
  if (assistantPartsHaveVisibleText(existingParts)) {
    return;
  }

  const consumedParts = consumedMessage
    ? normalizeChatMessageParts(uiPartsToChatParts(consumedMessage.parts))
    : [];
  if (assistantPartsHaveVisibleText(consumedParts)) {
    const existingMetadata =
      existingMessage?.metadata && typeof existingMessage.metadata === "object"
        ? (existingMessage.metadata as MessageMetadata)
        : {};
    await withTenantId(args.input.tenantId, () =>
      updateMessage({
        id: args.assistantMessageId,
        metadata: existingMetadata,
        parts: consumedParts as DBMessage["parts"],
      })
    );
    return;
  }

  const fallbackText = (await ctx.result.text).trim();
  if (!fallbackText) {
    return;
  }

  const existingMetadata =
    existingMessage?.metadata && typeof existingMessage.metadata === "object"
      ? (existingMessage.metadata as MessageMetadata)
      : {};
  const parts = [{ text: fallbackText, type: "text" as const }];
  await withTenantId(args.input.tenantId, async () => {
    await updateChatWorkflowRunStatus({
      status: "success",
      workflowRunId: args.workflowRunId,
    });
    await updateMessage({
      id: args.assistantMessageId,
      metadata: {
        ...existingMetadata,
        workflowRunStatus: "success",
      },
      parts: parts as DBMessage["parts"],
    });
  });
}

/** Headless chat completion for Slack/Teams — waits for stream + DB persistence. */
export async function runChatStreamTurnToCompletion(args: ChatStreamTurnArgs) {
  const ctx = await buildChatStreamTextResult(args);
  let finishResolve!: () => void;
  let finishReject!: (error: unknown) => void;
  const finished = new Promise<void>((resolve, reject) => {
    finishResolve = resolve;
    finishReject = reject;
  });

  const response = createChatStreamResponseFromContext(ctx, {
    onError: () => {
      finishReject(new Error("Chat stream failed"));
    },
    onFinish: () => {
      finishResolve();
      return Promise.resolve();
    },
  });

  if (!(response.ok && response.body)) {
    throw new Error("Failed to start chat stream.");
  }

  const { consumeChatStreamResponse } = await import(
    "@/core/lib/slack-integration/consume-chat-stream"
  );
  try {
    const consumedMessage = await consumeChatStreamResponse({
      assistantMessageId: args.assistantMessageId,
      response,
    });
    await finished;
    await ensureHeadlessAssistantTurnText(ctx, args, consumedMessage);
  } catch (error) {
    finishReject(error);
    throw error;
  }

  return args.assistantMessageId;
}

export async function reserveChatRunMetadata(args: {
  tenantId: string;
  assistantMessageId: string;
  workflowRunId: string;
  modelId: string;
}) {
  await withTenantId(args.tenantId, () =>
    updateAssistantWorkflowRunMetadata({
      assistantMessageId: args.assistantMessageId,
      modelId: args.modelId,
      workflowRunId: args.workflowRunId,
      workflowRunStatus: "running",
    })
  );
}
