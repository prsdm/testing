import { createHash } from "node:crypto";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  startChatLatencySpan,
  withChatLatencySpan,
} from "@/core/lib/ai/chat-latency";
import {
  createChatStreamResponse,
  reserveChatRunMetadata,
} from "@/core/lib/ai/chat-stream-turn";
import { buildChatTools } from "@/core/lib/ai/chat-tools";
import {
  prepareChatWorkflowAccess,
  prepareChatWorkflowTurn,
} from "@/core/lib/ai/chat-turn-server";
import { convertChatUiMessagesForModel } from "@/core/lib/ai/convert-chat-ui-messages";
import { resolveToolApprovalStep } from "@/core/lib/ai/resolve-tool-approval-step";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import {
  encodeExecutedToolPartSync,
  extractExecutedToolPartUpdates,
} from "@/core/lib/chat/executed-tool-part-sync";
import { loadRoomThreadWorkflowUiMessages } from "@/core/lib/chat/room-workflow-ui-messages";
import { saveChannelHumanMessage } from "@/core/lib/chat/save-channel-human-message";
import {
  createChatWorkflowRun,
  getChatWorkflowRun,
  getChatWorkflowRunByIdempotencyKey,
  getMessageById,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { getUserProfileForMember } from "@/core/lib/db/user-profile-queries";
import { REASONING_EFFORT_LEVELS } from "@/shared/ai/reasoning-effort";
import {
  assistantTurnNeedsPendingTodoContinuation,
  assistantTurnNeedsTodoExecutionContinuation,
} from "@/shared/chat/assistant-turn-continuation";
import { messageInvokesKimiro } from "@/shared/chat/kimiro-mention";
import { uiPartsToChatParts } from "@/shared/chat/ui-message-parts";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import {
  composerConnectorFocusesSchema,
  composerConnectorFocusSchema,
} from "@/shared/connectors/composer-connector-focus-schema";
import { mergeComposerConnectorFocuses } from "@/shared/connectors/composer-connector-focuses";
import { ChatbotError } from "@/shared/errors";
import { resolveKimiroAddressName } from "@/shared/kimiro-user-name";
import { type MessageMetadata, messageMetadataSchema } from "@/shared/types";
import { generateUUID } from "@/shared/utils";

export const maxDuration = 300;

const startBodySchema = z.object({
  assistantMessageId: z.string().uuid().optional(),
  blockedApprovalToolNames: z.array(z.string().min(1)).optional(),
  knowledgeBaseId: z.string().uuid().nullable().optional(),
  composerConnectorFocus: composerConnectorFocusSchema.optional(),
  composerConnectorFocuses: composerConnectorFocusesSchema,
  message: z.string().trim().min(1).max(8000).optional(),
  messageId: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  reasoningEffort: z.enum(REASONING_EFFORT_LEVELS).optional(),
  requireApproval: z.boolean().optional(),
  runId: z.string().uuid().optional(),
  selectedChatModel: z.string().optional(),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  userMessageId: z.string().uuid().optional(),
  threadRootMessageId: z.string().uuid().nullable().optional(),
  writeToolsBlocked: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

function latestMessageId(
  messages: unknown[] | undefined,
  role: "user" | "assistant"
): string | undefined {
  for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
    const message = messages?.[index];
    if (
      message &&
      typeof message === "object" &&
      (message as { role?: unknown }).role === role &&
      typeof (message as { id?: unknown }).id === "string"
    ) {
      return (message as { id: string }).id;
    }
  }
  return undefined;
}

function userMessageMetadataFromBody(
  body: z.infer<typeof startBodySchema>,
  userMessageId: string
): MessageMetadata | null {
  const messages = body.messages ?? [];
  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }
    const record = message as {
      id?: unknown;
      metadata?: unknown;
      role?: unknown;
    };
    if (record.role !== "user" || record.id !== userMessageId) {
      continue;
    }
    const parsed = messageMetadataSchema.safeParse(record.metadata);
    return parsed.success ? parsed.data : null;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") {
      continue;
    }
    const record = message as { metadata?: unknown; role?: unknown };
    if (record.role !== "user") {
      continue;
    }
    const parsed = messageMetadataSchema.safeParse(record.metadata);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

function latestUserText(body: z.infer<typeof startBodySchema>): string {
  if (body.message) {
    return body.message;
  }
  const messages = body.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") {
      continue;
    }
    const record = message as { role?: unknown; parts?: unknown };
    if (record.role !== "user" || !Array.isArray(record.parts)) {
      continue;
    }
    const text = record.parts
      .filter((part): part is { type: "text"; text: string } =>
        Boolean(
          part &&
            typeof part === "object" &&
            (part as { type?: unknown }).type === "text" &&
            typeof (part as { text?: unknown }).text === "string"
        )
      )
      .map((part) => part.text)
      .join("");
    if (text.trim()) {
      return text.trim();
    }
  }
  throw new ChatbotError("bad_request:api", "A user message is required");
}

function workflowRunIdForAssistant(
  messages: UIMessage[],
  assistantMessageId: string
): string | undefined {
  const assistant = messages.find(
    (message) =>
      message.role === "assistant" && message.id === assistantMessageId
  );
  if (!assistant?.metadata) {
    return undefined;
  }
  return (assistant.metadata as { workflowRunId?: string }).workflowRunId;
}

export async function POST(request: Request, { params }: RouteParams) {
  const firstByteSpan = startChatLatencySpan("chat.turn.first_stream_byte", {});
  try {
    const { id: chatId } = await params;
    const json = await request.json();
    const body = startBodySchema.parse(json);
    const message = latestUserText(body);
    const lastMessage = body.messages?.at(-1) as
      | { role?: unknown; id?: unknown }
      | undefined;
    const userMessageId =
      body.userMessageId ??
      latestMessageId(body.messages, "user") ??
      generateUUID();
    const assistantMessageId =
      body.assistantMessageId ??
      (lastMessage?.role === "assistant" && typeof lastMessage.id === "string"
        ? lastMessage.id
        : generateUUID());
    const startsNewUserTurn = lastMessage?.role === "user";
    const requestFingerprint = createHash("sha256")
      .update(
        body.messages?.length
          ? JSON.stringify(body.messages)
          : `${userMessageId}:${message}`
      )
      .digest("hex");
    const access = await prepareChatWorkflowAccess({
      chatId,
      knowledgeBaseId: body.knowledgeBaseId,
      requestFingerprint,
      titleSource: message,
      userMessageId,
    });

    const threadRootMessageId = body.threadRootMessageId ?? null;

    const connectorFocuses = mergeComposerConnectorFocuses(
      body.composerConnectorFocuses as ComposerConnectorFocus[] | undefined,
      body.composerConnectorFocus as ComposerConnectorFocus | undefined
    );
    const clientUserMetadata = userMessageMetadataFromBody(body, userMessageId);
    const userMessageMetadata: MessageMetadata | null =
      clientUserMetadata || connectorFocuses.length > 0
        ? {
            ...(clientUserMetadata ?? {}),
            ...(connectorFocuses.length > 0
              ? {
                  composerConnectorFocus: connectorFocuses[0],
                  composerConnectorFocuses: connectorFocuses,
                }
              : {}),
          }
        : null;

    if (isRoomChat(access.chat) && !messageInvokesKimiro(message)) {
      const memberProfile = await withTenantForUser(access.session.user, () =>
        getUserProfileForMember({
          authUserId: access.session.user.id,
          tenantId: access.tenantId,
        })
      );
      const authorDisplayName =
        resolveKimiroAddressName({
          fullName: access.session.user.name,
          preferredName: memberProfile?.preferredName,
        }) ??
        access.session.user.email ??
        "Member";
      await withTenantForUser(access.session.user, () =>
        saveChannelHumanMessage({
          authorAuthUserId: access.session.user.id,
          authorDisplayName,
          authorEmail: access.session.user.email,
          authorImage: access.session.user.image,
          chatId,
          composerText: clientUserMetadata?.composerText ?? message,
          text: message,
          threadRootMessageId,
          userMessageId,
          userMessageMetadata,
        })
      );
      return Response.json(
        { assistantSkipped: true, userMessageId },
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    let idempotencyKey = access.idempotencyKey;
    const existing = await withTenantForUser(access.session.user, () =>
      getChatWorkflowRunByIdempotencyKey(idempotencyKey)
    );
    if (existing) {
      if (existing.status === "failed" || existing.status === "cancelled") {
        idempotencyKey = `${idempotencyKey}:retry:${generateUUID()}`;
      } else if (
        !startsNewUserTurn &&
        (existing.status === "suspended" ||
          existing.status === "running" ||
          existing.status === "success")
      ) {
        // Continuation of the same assistant turn reuses the existing mapping.
      } else {
        throw new ChatbotError(
          "bad_request:api",
          "A chat turn is already in progress for this message."
        );
      }
    }

    const prepared = await prepareChatWorkflowTurn({
      access,
      assistantMessageId,
      blockedApprovalToolNames: body.blockedApprovalToolNames,
      chatId,
      connectorFocuses,
      idempotencyKey,
      knowledgeBaseId: body.knowledgeBaseId,
      message,
      reasoningEffort: body.reasoningEffort,
      selectedChatModel: body.selectedChatModel,
      threadRootMessageId,
      userMessageId,
      userMessageMetadata,
      writeToolsBlocked: body.writeToolsBlocked,
    });

    const clientUiMessages = (body.messages ?? []) as UIMessage[];
    const roomHistoryThreadRoot = prepared.input.roomHistoryThreadRootMessageId;
    const uiMessages = roomHistoryThreadRoot
      ? await withTenantForUser(prepared.sessionUser, () =>
          loadRoomThreadWorkflowUiMessages({
            chatId,
            historyThreadRootMessageId: roomHistoryThreadRoot,
          })
        )
      : clientUiMessages;
    const [assistantMessage] = await withTenantForUser(
      prepared.sessionUser,
      () => getMessageById({ id: assistantMessageId })
    );
    const persistedRunId =
      assistantMessage?.metadata &&
      typeof assistantMessage.metadata === "object"
        ? (assistantMessage.metadata as { workflowRunId?: string })
            .workflowRunId
        : undefined;
    const workflowRunId = startsNewUserTurn
      ? (body.runId ?? generateUUID())
      : (body.runId ??
        persistedRunId ??
        workflowRunIdForAssistant(uiMessages, assistantMessageId) ??
        generateUUID());
    const modelMessages =
      uiMessages.length > 0
        ? await convertChatUiMessagesForModel({
            continuationAssistantMessageId: startsNewUserTurn
              ? undefined
              : assistantMessageId,
            modelId: prepared.input.modelId,
            uiMessages,
          })
        : prepared.input.messages;

    const existingRun = await withTenantForUser(prepared.sessionUser, () =>
      getChatWorkflowRun(workflowRunId)
    );

    if (existingRun) {
      if (existingRun.assistantMessageId !== assistantMessageId) {
        throw new ChatbotError(
          "bad_request:api",
          "Workflow run is already bound to another assistant message."
        );
      }
      if (existingRun.status === "cancelled" && !startsNewUserTurn) {
        throw new ChatbotError(
          "bad_request:api",
          "This workflow run was cancelled."
        );
      }
      await withTenantForUser(prepared.sessionUser, () =>
        updateChatWorkflowRunStatus({
          status: "running",
          workflowRunId,
        })
      );
    } else {
      const mapping = await withChatLatencySpan(
        "chat.turn.mapping.reserve",
        {},
        () =>
          withTenantForUser(prepared.sessionUser, () =>
            createChatWorkflowRun({
              assistantMessageId,
              authUserId: prepared.sessionUser.id,
              chatId,
              idempotencyKey,
              modelId: prepared.input.modelId,
              userMessageId,
              workflowRunId,
            })
          )
      );
      if (mapping?.workflowRunId !== workflowRunId) {
        throw new ChatbotError(
          "bad_request:api",
          "A chat turn is already in progress for this message."
        );
      }
    }

    const assistantUiMessage = uiMessages.find(
      (candidate) =>
        candidate.role === "assistant" && candidate.id === assistantMessageId
    );
    const assistantMetadata =
      assistantMessage?.metadata &&
      typeof assistantMessage.metadata === "object"
        ? (assistantMessage.metadata as MessageMetadata)
        : {};
    const assistantParts = assistantUiMessage
      ? uiPartsToChatParts(assistantUiMessage.parts)
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
    let resolvedModelMessages = modelMessages;
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
          (message) => message.id === assistantMessageId
        );
        if (assistant) {
          const previousParts = uiPartsToChatParts(
            uiMessages.find((message) => message.id === assistantMessageId)
              ?.parts ?? []
          );
          const nextParts = uiPartsToChatParts(assistant.parts);
          const executedUpdates = extractExecutedToolPartUpdates({
            nextParts,
            previousParts,
          });
          if (executedUpdates.length > 0) {
            executedToolPartSync = encodeExecutedToolPartSync(executedUpdates);
          }

          await withTenantForUser(prepared.sessionUser, () =>
            updateMessage({
              id: assistantMessageId,
              parts: nextParts as DBMessage["parts"],
            })
          );
        }
      }
    }

    return await createChatStreamResponse({
      assistantMessageId,
      assistantMessageMetadata: resolvedAssistantMetadata,
      executedToolPartSync,
      firstByteSpan,
      input: prepared.input,
      isContinuationTurn: !startsNewUserTurn,
      modelMessages: resolvedModelMessages,
      uiMessages: resolvedUiMessages,
      workflowRunId,
    });
  } catch (error) {
    firstByteSpan.end();
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    if (error instanceof z.ZodError) {
      return new ChatbotError(
        "bad_request:api",
        error.issues.map((issue) => issue.message).join("; ")
      ).toResponse();
    }
    throw error;
  }
}
