import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import {
  reserveChatRunMetadata,
  runChatStreamTurnToCompletion,
} from "@/core/lib/ai/chat-stream-turn";
import { buildChatTools } from "@/core/lib/ai/chat-tools";
import {
  prepareChatWorkflowTurn,
  prepareHeadlessChatWorkflowAccess,
} from "@/core/lib/ai/chat-turn-server";
import { convertChatUiMessagesForModel } from "@/core/lib/ai/convert-chat-ui-messages";
import { resolveHeadlessChatTurnModelSettings } from "@/core/lib/ai/resolve-headless-chat-turn";
import { resolveToolApprovalStep } from "@/core/lib/ai/resolve-tool-approval-step";
import { convertToUIMessages } from "@/core/lib/chat/convert-db-messages-to-ui";
import {
  encodeExecutedToolPartSync,
  extractExecutedToolPartUpdates,
} from "@/core/lib/chat/executed-tool-part-sync";
import {
  createChatWorkflowRun,
  getChatWorkflowRun,
  getMessageById,
  getMessagesByChatId,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantId,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import {
  assistantTurnNeedsPendingTodoContinuation,
  assistantTurnNeedsTodoExecutionContinuation,
} from "@/shared/chat/assistant-turn-continuation";
import { uiPartsToChatParts } from "@/shared/chat/ui-message-parts";
import { ChatbotError } from "@/shared/errors";
import type { MessageMetadata } from "@/shared/types";
import { generateUUID } from "@/shared/utils";

const MAX_SLACK_TURN_CONTINUATIONS = 4;

export type SlackChatTurnResult = {
  chatId: string;
  assistantMessageId: string;
  workflowRunId: string;
  parts: ReturnType<typeof uiPartsToChatParts>;
  metadata: MessageMetadata;
  workflowRunStatus: MessageMetadata["workflowRunStatus"];
};

async function loadAssistantTurn(args: {
  tenantId: string;
  assistantMessageId: string;
}) {
  const [assistantMessage] = await withTenantId(args.tenantId, () =>
    getMessageById({ id: args.assistantMessageId })
  );
  if (!assistantMessage) {
    throw new ChatbotError("not_found:chat", "Assistant message not found");
  }
  const uiMessage = convertToUIMessages([assistantMessage]).at(0);
  const parts = uiPartsToChatParts(
    (uiMessage?.parts as UIMessage["parts"] | undefined) ?? []
  );
  const metadata = (assistantMessage.metadata ?? {}) as MessageMetadata;
  return { assistantMessage, metadata, parts };
}

export async function executeSlackChatTurn(args: {
  tenantId: string;
  tenantSlug: string;
  authUserId: string;
  email: string;
  name: string | null;
  chatId: string;
  message?: string;
  isContinuation?: boolean;
  assistantMessageId?: string;
  workflowRunId?: string;
}): Promise<SlackChatTurnResult> {
  const startsNewUserTurn = !args.isContinuation;
  const message = startsNewUserTurn ? args.message?.trim() : "";
  if (startsNewUserTurn && !message) {
    throw new ChatbotError("bad_request:api", "A user message is required");
  }

  const workflowRunId =
    args.workflowRunId ?? (startsNewUserTurn ? generateUUID() : undefined);
  if (!workflowRunId) {
    throw new ChatbotError("bad_request:api", "Workflow run id required");
  }

  const existingRun = await withTenantId(args.tenantId, () =>
    getChatWorkflowRun(workflowRunId)
  );
  const userMessageId = startsNewUserTurn
    ? generateUUID()
    : (existingRun?.userMessageId ?? "");
  if (!userMessageId) {
    throw new ChatbotError("bad_request:api", "User message id required");
  }

  const requestFingerprint = createHash("sha256")
    .update(startsNewUserTurn ? `${userMessageId}:${message}` : "continuation")
    .digest("hex");

  const access = await prepareHeadlessChatWorkflowAccess({
    authUserId: args.authUserId,
    chatId: args.chatId,
    email: args.email,
    name: args.name,
    requestFingerprint,
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    titleSource: message || "Slack conversation",
    userMessageId,
  });

  const assistantMessageId =
    args.assistantMessageId ?? (startsNewUserTurn ? generateUUID() : undefined);
  if (!assistantMessageId) {
    throw new ChatbotError("bad_request:api", "Assistant message id required");
  }

  const headlessModel = await resolveHeadlessChatTurnModelSettings(
    args.tenantId
  );

  const prepared = await prepareChatWorkflowTurn({
    access,
    assistantMessageId,
    chatId: args.chatId,
    idempotencyKey: access.idempotencyKey,
    message: message || "Continue.",
    reasoningEffort: headlessModel.reasoningEffort,
    selectedChatModel: headlessModel.modelId,
    userMessageId,
    writeToolsBlocked: false,
  });

  const dbMessages = await withTenantId(args.tenantId, () =>
    getMessagesByChatId({ id: args.chatId })
  );
  const uiMessages = convertToUIMessages(dbMessages) as UIMessage[];

  if (existingRun) {
    await withTenantId(args.tenantId, () =>
      updateChatWorkflowRunStatus({
        status: "running",
        workflowRunId,
      })
    );
  } else if (startsNewUserTurn) {
    await withTenantId(args.tenantId, () =>
      createChatWorkflowRun({
        assistantMessageId,
        authUserId: args.authUserId,
        chatId: args.chatId,
        idempotencyKey: access.idempotencyKey,
        modelId: prepared.input.modelId,
        userMessageId,
        workflowRunId,
      })
    );
  }

  const [assistantMessage] = await withTenantId(args.tenantId, () =>
    getMessageById({ id: assistantMessageId })
  );
  const assistantMetadata =
    assistantMessage?.metadata && typeof assistantMessage.metadata === "object"
      ? (assistantMessage.metadata as MessageMetadata)
      : {};
  const assistantUiMessage = uiMessages.find(
    (candidate) =>
      candidate.role === "assistant" && candidate.id === assistantMessageId
  );
  const assistantParts = assistantUiMessage
    ? uiPartsToChatParts(assistantUiMessage.parts as UIMessage["parts"])
    : [];
  const needsExecutionNudge =
    !startsNewUserTurn &&
    assistantMessage &&
    assistantUiMessage &&
    assistantMetadata.todoExecutionNudged !== true &&
    assistantTurnNeedsTodoExecutionContinuation(assistantParts);
  const needsPendingStepsNudge =
    !startsNewUserTurn &&
    assistantMessage &&
    assistantUiMessage &&
    assistantMetadata.todoPendingStepsNudged !== true &&
    assistantTurnNeedsPendingTodoContinuation(assistantParts);

  const resolvedAssistantMetadata: MessageMetadata = {
    ...assistantMetadata,
    ...(needsExecutionNudge ? { todoExecutionNudged: true } : {}),
    ...(needsPendingStepsNudge ? { todoPendingStepsNudged: true } : {}),
  };

  reserveChatRunMetadata({
    assistantMessageId,
    modelId: prepared.input.modelId,
    tenantId: prepared.input.tenantId,
    workflowRunId,
  }).catch(() => undefined);

  const { tools, toolsContext } = buildChatTools({
    configuration: prepared.input.toolConfiguration,
    input: prepared.input,
    workflowRunId,
  });

  let resolvedUiMessages = uiMessages;
  let resolvedModelMessages = await convertChatUiMessagesForModel({
    continuationAssistantMessageId: startsNewUserTurn
      ? undefined
      : assistantMessageId,
    modelId: prepared.input.modelId,
    uiMessages,
  });
  let executedToolPartSync: string | undefined;

  if (!startsNewUserTurn && uiMessages.length > 0) {
    const resolved = await resolveToolApprovalStep({
      tools,
      toolsContext,
      uiMessages,
    });
    if (resolved.changed) {
      resolvedUiMessages = resolved.uiMessages;
      resolvedModelMessages = await convertChatUiMessagesForModel({
        continuationAssistantMessageId: assistantMessageId,
        modelId: prepared.input.modelId,
        tools,
        uiMessages: resolvedUiMessages,
      });
      const assistant = resolvedUiMessages.find(
        (candidate) => candidate.id === assistantMessageId
      );
      if (assistant) {
        const previousParts = uiPartsToChatParts(
          (uiMessages.find((candidate) => candidate.id === assistantMessageId)
            ?.parts as UIMessage["parts"] | undefined) ?? []
        );
        const nextParts = uiPartsToChatParts(
          assistant.parts as UIMessage["parts"]
        );
        const executedUpdates = extractExecutedToolPartUpdates({
          nextParts,
          previousParts,
        });
        if (executedUpdates.length > 0) {
          executedToolPartSync = encodeExecutedToolPartSync(executedUpdates);
        }
        await withTenantId(args.tenantId, () =>
          updateMessage({
            id: assistantMessageId,
            parts: nextParts as DBMessage["parts"],
          })
        );
      }
    }
  }

  await runChatStreamTurnToCompletion({
    assistantMessageId,
    assistantMessageMetadata: resolvedAssistantMetadata,
    executedToolPartSync,
    input: prepared.input,
    isContinuationTurn: !startsNewUserTurn,
    modelMessages: resolvedModelMessages,
    uiMessages: resolvedUiMessages,
    workflowRunId,
  });

  const turn = await loadAssistantTurn({
    assistantMessageId,
    tenantId: args.tenantId,
  });

  return {
    assistantMessageId,
    chatId: args.chatId,
    metadata: turn.metadata,
    parts: turn.parts,
    workflowRunId,
    workflowRunStatus: turn.metadata.workflowRunStatus ?? "success",
  };
}

export async function executeSlackChatTurnWithContinuations(args: {
  tenantId: string;
  tenantSlug: string;
  authUserId: string;
  email: string;
  name: string | null;
  chatId: string;
  message?: string;
  isContinuation?: boolean;
  assistantMessageId?: string;
  workflowRunId?: string;
}) {
  let result = await executeSlackChatTurn(args);
  let iterations = 0;

  while (
    iterations < MAX_SLACK_TURN_CONTINUATIONS &&
    (result.workflowRunStatus === "running" ||
      result.metadata.workflowRunStatus === "running")
  ) {
    iterations += 1;
    result = await executeSlackChatTurn({
      assistantMessageId: result.assistantMessageId,
      authUserId: args.authUserId,
      chatId: args.chatId,
      email: args.email,
      isContinuation: true,
      name: args.name,
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      workflowRunId: result.workflowRunId,
    });
  }

  return result;
}
