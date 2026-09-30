import {
  buildChatHistory,
  formatRoomSpeakerMessageContent,
} from "@/core/lib/ai/chat-history";
import { withChatLatencySpan } from "@/core/lib/ai/chat-latency";
import type { ChatToolContext } from "@/core/lib/ai/chat-tool-executors";
import type {
  ChatWorkflowInput,
  ConnectorWorkflowToolDescriptor,
} from "@/core/lib/ai/chat-workflow-types";
import { resolveUniqueKnowledgeBaseHintFromMessage } from "@/core/lib/ai/tools/knowledge-base-scope";
import { auth } from "@/core/lib/auth/server-session";
import { assertTenantUsageAllowed } from "@/core/lib/billing/assert-usage-allowed";
import {
  assertChatApiAccess,
  assertChatApiAccessForTenant,
} from "@/core/lib/chat/assert-chat-api-access";
import { ensureChannelKnowledgeBase } from "@/core/lib/chat/channel-knowledge-base";
import { assertChatReadable, isRoomChat } from "@/core/lib/chat/chat-access";
import { notifyChatRoomMessagesChanged } from "@/core/lib/chat/chat-room-bus";
import { convertToUIMessages } from "@/core/lib/chat/convert-db-messages-to-ui";
import { resolveKnowledgeBaseChatContext } from "@/core/lib/chat/knowledge-base-chat-context";
import {
  mergeUserMessageMetadataForPersist,
  messageMetadataHasComposerDisplay,
} from "@/core/lib/chat/message-metadata";
import { formatRoomKimiroContextPrompt } from "@/core/lib/chat/room-kimiro-context";
import { resolveRoomKimiroThreadScope } from "@/core/lib/chat/room-kimiro-thread";
import { nextRoomMessageCreatedAtPair } from "@/core/lib/chat/room-message-created-at";
import { listRoomParticipantsForKimiro } from "@/core/lib/chat/room-participants";
import { buildConnectorToolsForChat } from "@/core/lib/connectors/build-chat-tools";
import { listChatToolConfigIdsForUser } from "@/core/lib/connectors/list-chat-tool-config-ids";
import { getToolParams } from "@/core/lib/connectors/providers/params-registry";
import { getWorkspacePrompt } from "@/core/lib/db/general-settings-queries";
import {
  listTenantAvailableChatModels,
  resolveTenantDefaultChatModelId,
  resolveTenantLlmKeys,
} from "@/core/lib/db/llm-provider-queries";
import {
  getChatById,
  getMessageById,
  getMessagesByChatId,
  getTenantAccessContextByEmail,
  isTenantMemberAccessAllowed,
  saveChat,
  saveMessages,
  toTenantUserId,
  updateChatKnowledgeBaseById,
  updateMessage,
  withTenantForUser,
  withTenantId,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { getUserProfileForMember } from "@/core/lib/db/user-profile-queries";
import { resolveTenantWebSearchConfig } from "@/core/lib/db/web-search-queries";
import { listKnowledgeBasesForUser } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { buildMcpToolsForChat } from "@/core/lib/mcp/build-mcp-chat-tools";
import { resolveTenantSandboxConfig } from "@/core/lib/sandbox/tenant-sandbox";
import { createSharedCitationContext } from "@/core/lib/search/citation-context";
import { evaluateTenantAccess } from "@/core/lib/tenant/access-gate";
import { resolveCanonicalModelId } from "@/shared/ai/model-id-migrations";
import { DEFAULT_CHAT_MODEL } from "@/shared/ai/models";
import type { ReasoningEffortLevel } from "@/shared/ai/reasoning-effort";
import { resolveApprovalToolGateForTurn } from "@/shared/ai/tool-approvals";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import {
  messageInvokesKimiro,
  stripKimiroMention,
} from "@/shared/chat/kimiro-mention";
import { chatTitleFromMessage } from "@/shared/chat/title";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import { ChatbotError } from "@/shared/errors";
import { resolveKimiroAddressName } from "@/shared/kimiro-user-name";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";
import { generateUUID, isUuid } from "@/shared/utils";

type SessionUser = NonNullable<Awaited<ReturnType<typeof auth>>>["user"];

async function requireTenantPrincipal() {
  const session = await auth();
  const userEmail = session?.user?.email;
  if (!(session?.user && userEmail)) {
    throw new ChatbotError("unauthorized:chat");
  }
  if (
    (await assertChatApiAccess({
      userEmail,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    throw new ChatbotError("forbidden:chat");
  }

  const accessContext = await withTenantForUser(session.user, async () => {
    const context = await getTenantAccessContextByEmail(userEmail);
    if (!context?.tenantId) {
      throw new ChatbotError("forbidden:chat");
    }
    const memberAllowed = await isTenantMemberAccessAllowed({
      authUserId: session.user.id,
      tenantId: context.tenantId,
    });
    if (
      evaluateTenantAccess({
        allowedOrgUnits: context.allowedOrgUnits,
        memberAllowed,
        personOrgUnit: context.personOrgUnit,
        personStatus: context.personStatus,
      })
    ) {
      throw new ChatbotError("forbidden:chat");
    }
    return context;
  });

  return {
    accessContext,
    session,
    tenantUserId: toTenantUserId(session.user.id),
  };
}

export async function requireChatRunAccess(chatId: string) {
  if (!isUuid(chatId)) {
    throw new ChatbotError("bad_request:api", "Invalid chat id");
  }

  const principal = await requireTenantPrincipal();
  const chat = await withTenantForUser(principal.session.user, () =>
    getChatById({ id: chatId })
  );
  if (!chat) {
    throw new ChatbotError("not_found:chat");
  }
  if (chat.userId !== principal.tenantUserId) {
    throw new ChatbotError("forbidden:chat");
  }

  return {
    chat,
    session: principal.session,
    tenantId: principal.accessContext.tenantId,
    tenantSlug: principal.accessContext.tenantSlug,
    tenantUserId: principal.tenantUserId,
  };
}

export type PreparedChatWorkflowAccess = Awaited<
  ReturnType<typeof prepareChatWorkflowAccess>
>;

export async function prepareChatWorkflowAccess(args: {
  chatId: string;
  knowledgeBaseId?: string | null;
  titleSource: string;
  requestFingerprint: string;
  userMessageId: string;
}) {
  if (!isUuid(args.chatId)) {
    throw new ChatbotError("bad_request:api", "Invalid chat id");
  }

  return await withChatLatencySpan("chat.turn.access", {}, async () => {
    const principal = await requireTenantPrincipal();
    const chat = await withTenantForUser(principal.session.user, async () => {
      const existing = await getChatById({ id: args.chatId });
      if (existing) {
        await assertChatReadable({
          authUserId: principal.session.user.id,
          chat: existing,
          tenantUserId: principal.tenantUserId,
        });
        if (isRoomChat(existing)) {
          const knowledgeBaseId = await ensureChannelKnowledgeBase({
            actorAuthUserId: principal.session.user.id,
            chat: existing,
          });
          return { ...existing, knowledgeBaseId };
        }
        if (
          args.knowledgeBaseId !== undefined &&
          args.knowledgeBaseId !== existing.knowledgeBaseId
        ) {
          await updateChatKnowledgeBaseById({
            chatId: args.chatId,
            knowledgeBaseId: args.knowledgeBaseId ?? null,
          });
          return { ...existing, knowledgeBaseId: args.knowledgeBaseId ?? null };
        }
        return existing;
      }

      await saveChat({
        id: args.chatId,
        knowledgeBaseId: args.knowledgeBaseId ?? null,
        title: chatTitleFromMessage({
          id: generateUUID(),
          parts: [{ text: args.titleSource, type: "text" }],
          role: "user",
        }),
        userId: principal.tenantUserId,
      });
      const created = await getChatById({ id: args.chatId });
      if (!created) {
        throw new ChatbotError("bad_request:database", "Failed to save chat");
      }
      return created;
    });

    if (!principal.accessContext.tenantSlug) {
      throw new ChatbotError("forbidden:chat", "Tenant slug missing");
    }

    return {
      chat,
      idempotencyKey: `${principal.accessContext.tenantId}:${args.chatId}:${args.userMessageId}:${args.requestFingerprint}`,
      session: principal.session,
      tenantId: principal.accessContext.tenantId,
      tenantSlug: principal.accessContext.tenantSlug,
      tenantUserId: principal.tenantUserId,
    };
  });
}

function connectorInputJsonSchema(toolId: string): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of getToolParams(toolId)) {
    const type = (param.type ?? "string").toLowerCase();
    const schema = type.includes("string[]")
      ? {
          anyOf: [
            { type: "string" },
            { items: { type: "string" }, type: "array" },
          ],
        }
      : type === "number"
        ? { type: "number" }
        : type === "integer"
          ? { type: "integer" }
          : type === "boolean"
            ? { type: "boolean" }
            : { type: "string" };
    properties[param.name] = {
      ...schema,
      ...(param.description ? { description: param.description } : {}),
    };
    if (param.required) {
      required.push(param.name);
    }
  }
  return {
    additionalProperties: false,
    properties,
    type: "object",
    ...(required.length > 0 ? { required } : {}),
  };
}

export async function prepareChatWorkflowTurn(args: {
  access: PreparedChatWorkflowAccess;
  chatId: string;
  message: string;
  selectedChatModel?: string;
  reasoningEffort?: ReasoningEffortLevel;
  knowledgeBaseId?: string | null;
  connectorFocuses?: ComposerConnectorFocus[];
  writeToolsBlocked?: boolean;
  blockedApprovalToolNames?: string[];
  userMessageId: string;
  assistantMessageId: string;
  idempotencyKey: string;
  threadRootMessageId?: string | null;
  userMessageMetadata?: MessageMetadata | null;
}): Promise<{
  input: ChatWorkflowInput;
  sessionUser: SessionUser;
}> {
  const access = args.access;
  const sessionUser = access.session.user;
  const roomTurn = isRoomChat(access.chat);
  let turnMessage = args.message;
  if (roomTurn && messageInvokesKimiro(turnMessage)) {
    turnMessage = stripKimiroMention(turnMessage);
  }
  const roomKimiroThread = roomTurn
    ? resolveRoomKimiroThreadScope({
        clientThreadRootMessageId: args.threadRootMessageId ?? null,
        invokesKimiro: messageInvokesKimiro(args.message),
        userMessageId: args.userMessageId,
      })
    : null;
  let composerKnowledgeBaseId = roomTurn
    ? (access.chat.knowledgeBaseId ?? null)
    : (args.knowledgeBaseId ?? null);
  if (!composerKnowledgeBaseId && turnMessage.trim() && !roomTurn) {
    const userKnowledgeBases = await withTenantId(access.tenantId, () =>
      listKnowledgeBasesForUser({
        tenantId: access.tenantId,
        userId: sessionUser.id,
      })
    );
    const inferred = resolveUniqueKnowledgeBaseHintFromMessage({
      knowledgeBases: userKnowledgeBases.map((entry) => ({
        description: entry.description,
        id: entry.id,
        name: entry.name,
      })),
      message: turnMessage,
    });
    if (inferred) {
      composerKnowledgeBaseId = inferred.id;
    }
  }
  const [
    availableModels,
    llmKeys,
    workspacePrompt,
    dbMessages,
    knowledgeBaseContext,
    toolConfigIds,
    webSearchConfig,
    sandboxConfig,
    tenantDefaultChatModelId,
    memberProfile,
    roomParticipants,
  ] = await withChatLatencySpan(
    "chat.turn.prepare",
    {
      "chat.turn.knowledge_base": Boolean(composerKnowledgeBaseId),
    },
    () =>
      withTenantId(access.tenantId, () =>
        Promise.all([
          listTenantAvailableChatModels(access.tenantId),
          resolveTenantLlmKeys(access.tenantId),
          getWorkspacePrompt(access.tenantId),
          getMessagesByChatId({
            id: args.chatId,
            threadRootMessageId:
              roomKimiroThread?.historyThreadRootMessageId ?? undefined,
          }),
          composerKnowledgeBaseId
            ? resolveKnowledgeBaseChatContext({
                knowledgeBaseId: composerKnowledgeBaseId,
                tenantId: access.tenantId,
                userId: sessionUser.id,
              })
            : Promise.resolve(null),
          listChatToolConfigIdsForUser({
            tenantId: access.tenantId,
            userId: sessionUser.id,
          }),
          resolveTenantWebSearchConfig(access.tenantId),
          resolveTenantSandboxConfig(access.tenantId),
          args.selectedChatModel
            ? Promise.resolve(null)
            : resolveTenantDefaultChatModelId(access.tenantId),
          getUserProfileForMember({
            authUserId: sessionUser.id,
            tenantId: access.tenantId,
          }),
          roomTurn
            ? listRoomParticipantsForKimiro({
                chatId: args.chatId,
                tenantId: access.tenantId,
              })
            : Promise.resolve([]),
        ])
      )
  );

  const kimiroAddressName = resolveKimiroAddressName({
    fullName: sessionUser.name,
    preferredName: memberProfile?.preferredName,
  });
  const askerDisplayName = kimiroAddressName ?? sessionUser.email ?? "Member";
  const roomKimiroContext = roomTurn
    ? formatRoomKimiroContextPrompt({
        askerDisplayName,
        askerUserId: sessionUser.id,
        chat: access.chat,
        participants: roomParticipants,
      })
    : undefined;

  if (composerKnowledgeBaseId && !knowledgeBaseContext) {
    throw new ChatbotError(
      "bad_request:api",
      "Knowledge base not found or not accessible."
    );
  }

  const [connectorBundle, mcpBundle, usageGate] = await withChatLatencySpan(
    "chat.turn.tools.prepare",
    { "chat.tools.config_count": toolConfigIds.length },
    () =>
      Promise.all([
        withTenantId(access.tenantId, () =>
          buildConnectorToolsForChat({
            tenantId: access.tenantId,
            tenantSlug: access.tenantSlug,
            toolConfigIds,
            userId: sessionUser.id,
          })
        ),
        withTenantId(access.tenantId, () =>
          buildMcpToolsForChat({
            authUserId: sessionUser.id,
            tenantId: access.tenantId,
          })
        ),
        assertTenantUsageAllowed({
          authUserId: sessionUser.id,
          tenantId: access.tenantId,
        }),
      ])
  );
  const mcpTools = mcpBundle.descriptors;
  if (!usageGate.allowed) {
    throw new ChatbotError("forbidden:chat", usageGate.code, usageGate.message);
  }
  const connectorTools: ConnectorWorkflowToolDescriptor[] = [];
  for (const name of connectorBundle.activeToolNames) {
    const definition = connectorBundle.tools[name];
    const mapping = connectorBundle.nameMap.get(name);
    if (!(definition && mapping && "inputSchema" in definition)) {
      continue;
    }
    connectorTools.push({
      description:
        typeof definition.description === "string"
          ? definition.description
          : `Run the ${name} connector action`,
      inputSchema: connectorInputJsonSchema(mapping.toolId),
      name,
      providerId: mapping.providerId,
      toolConfigId: mapping.toolConfigId,
      toolId: mapping.toolId,
    });
  }

  const allowedModels = new Set(availableModels.map((model) => model.id));
  const requestedModel = resolveCanonicalModelId(
    args.selectedChatModel ?? tenantDefaultChatModelId ?? DEFAULT_CHAT_MODEL
  );
  const modelId = allowedModels.has(requestedModel)
    ? requestedModel
    : (availableModels[0]?.id ?? DEFAULT_CHAT_MODEL);

  const existingIds = new Set(dbMessages.map((message) => message.id));
  await withTenantId(access.tenantId, async () => {
    const messages: DBMessage[] = [];
    const { assistant: assistantCreatedAt, user: userCreatedAt } = roomTurn
      ? await nextRoomMessageCreatedAtPair({
          chatId: args.chatId,
          historyThreadRootMessageId:
            roomKimiroThread?.historyThreadRootMessageId,
          tenantId: access.tenantId,
        })
      : {
          assistant: new Date(Date.now() + 1),
          user: new Date(),
        };
    const userMessageWireText = args.message.trim();
    const roomAuthor = roomTurn
      ? {
          authorAuthUserId: sessionUser.id,
          authorDisplayName: askerDisplayName,
          authorEmail: sessionUser.email ?? undefined,
          authorImage: sessionUser.image ?? null,
        }
      : null;

    if (!existingIds.has(args.userMessageId)) {
      messages.push({
        attachments: [],
        chatId: args.chatId,
        createdAt: userCreatedAt,
        id: args.userMessageId,
        metadata: mergeUserMessageMetadataForPersist({
          createdAt: userCreatedAt.toISOString(),
          incoming: args.userMessageMetadata,
          roomAuthor,
          roomTurn,
          wireText: userMessageWireText,
        }),
        parts: [
          { text: userMessageWireText, type: "text" },
        ] as DBMessage["parts"],
        role: "user",
        threadRootMessageId:
          roomKimiroThread?.userThreadRootMessageId ??
          args.threadRootMessageId ??
          null,
      });
    } else if (
      args.userMessageMetadata &&
      !messageMetadataHasComposerDisplay(
        dbMessages.find((entry) => entry.id === args.userMessageId)?.metadata as
          | MessageMetadata
          | undefined
      )
    ) {
      const existing = dbMessages.find(
        (entry) => entry.id === args.userMessageId
      );
      await updateMessage({
        id: args.userMessageId,
        metadata: mergeUserMessageMetadataForPersist({
          createdAt:
            (existing?.metadata as MessageMetadata | undefined)?.createdAt ??
            userCreatedAt.toISOString(),
          existing: existing?.metadata as MessageMetadata | undefined,
          incoming: args.userMessageMetadata,
          roomAuthor,
          roomTurn,
          wireText: userMessageWireText,
        }),
        parts: [{ text: userMessageWireText, type: "text" }],
      });
    }
    if (!existingIds.has(args.assistantMessageId)) {
      messages.push({
        attachments: [],
        chatId: args.chatId,
        createdAt: assistantCreatedAt,
        id: args.assistantMessageId,
        metadata: {
          agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
          createdAt: assistantCreatedAt.toISOString(),
          modelId,
          replyToMessageId: args.userMessageId,
          workflowRunStatus: "pending",
        },
        parts: [{ text: "", type: "text" }] as DBMessage["parts"],
        role: "assistant",
        threadRootMessageId:
          roomKimiroThread?.assistantThreadRootMessageId ??
          args.threadRootMessageId ??
          null,
      });
    }
    if (messages.length > 0) {
      await saveMessages({ messages });
      if (roomTurn) {
        notifyChatRoomMessagesChanged({
          chatId: args.chatId,
          threadRootMessageId:
            roomKimiroThread?.historyThreadRootMessageId ??
            args.threadRootMessageId ??
            null,
        });
      }
    }
  });

  const historyOptions = roomTurn ? { labelRoomSpeakers: true } : undefined;
  const history = buildChatHistory(
    convertToUIMessages(dbMessages),
    historyOptions
  );
  const turnContent = roomTurn
    ? formatRoomSpeakerMessageContent(
        {
          id: args.userMessageId,
          metadata: { authorDisplayName: askerDisplayName },
          parts: [{ text: turnMessage, type: "text" }],
          role: "user",
        },
        historyOptions
      )
    : turnMessage;
  history.push({ content: turnContent, role: "user" });

  const assistantRow = dbMessages.find(
    (row) => row.id === args.assistantMessageId
  );
  const assistantParts = (assistantRow?.parts ?? []) as ChatMessagePart[];
  const approvalToolGate = resolveApprovalToolGateForTurn({
    assistantParts,
    blockedApprovalToolNames: args.blockedApprovalToolNames,
    writeToolsBlocked: args.writeToolsBlocked,
  });

  return {
    input: {
      assistantMessageId: args.assistantMessageId,
      authUser: {
        email: sessionUser.email as string,
        id: sessionUser.id,
        name: sessionUser.name,
        preferredName: kimiroAddressName,
      },
      blockedApprovalToolNames: approvalToolGate.blockedApprovalToolNames,
      chatId: args.chatId,
      idempotencyKey: args.idempotencyKey,
      connectorFocus: args.connectorFocuses?.[0] ?? null,
      connectorFocuses: args.connectorFocuses ?? [],
      knowledgeBaseId: knowledgeBaseContext?.knowledgeBaseId ?? null,
      knowledgeBaseName: knowledgeBaseContext?.knowledgeBaseName ?? null,
      llmKeys,
      messages: history,
      modelId,
      reasoningEffort: args.reasoningEffort,
      tenantId: access.tenantId,
      tenantSlug: access.tenantSlug,
      tenantUserId: access.tenantUserId,
      toolConfiguration: {
        connectorTools,
        mcpTools,
        sandboxEnabled: sandboxConfig.enabled,
        sandboxWorkSkillIds: sandboxConfig.workSkillIds,
        webSearchConfig: webSearchConfig?.search?.apiKey
          ? webSearchConfig
          : null,
      },
      turnUserMessage: args.message,
      userMessageId: args.userMessageId,
      userRejectedApprovalAttempts:
        approvalToolGate.userRejectedApprovalAttempts,
      roomHistoryThreadRootMessageId:
        roomKimiroThread?.historyThreadRootMessageId,
      roomKimiroContext,
      workspacePrompt: workspacePrompt ?? undefined,
      writeToolsBlocked: approvalToolGate.writeToolsBlocked,
    },
    sessionUser,
  };
}

export async function prepareChatToolRerunContext(args: {
  tenantId: string;
  tenantSlug: string;
  tenantUserId: string;
  chatId: string;
  assistantMessageId: string;
  workflowRunId: string;
  sessionUser: SessionUser;
}): Promise<ChatToolContext> {
  const [
    availableModels,
    llmKeys,
    workspacePrompt,
    toolConfigIds,
    webSearchConfig,
    sandboxConfig,
    assistantRow,
  ] = await withTenantForUser(args.sessionUser, () =>
    Promise.all([
      listTenantAvailableChatModels(args.tenantId),
      resolveTenantLlmKeys(args.tenantId),
      getWorkspacePrompt(args.tenantId),
      listChatToolConfigIdsForUser({
        tenantId: args.tenantId,
        userId: args.sessionUser.id,
      }),
      resolveTenantWebSearchConfig(args.tenantId),
      resolveTenantSandboxConfig(args.tenantId),
      getMessageById({ id: args.assistantMessageId }).then((rows) => rows[0]),
    ])
  );

  const [connectorBundle, mcpBundle, memberProfile] = await withTenantForUser(
    args.sessionUser,
    () =>
      Promise.all([
        buildConnectorToolsForChat({
          tenantId: args.tenantId,
          tenantSlug: args.tenantSlug,
          toolConfigIds,
          userId: args.sessionUser.id,
        }),
        buildMcpToolsForChat({
          authUserId: args.sessionUser.id,
          tenantId: args.tenantId,
        }),
        getUserProfileForMember({
          authUserId: args.sessionUser.id,
          tenantId: args.tenantId,
        }),
      ])
  );

  const kimiroAddressName = resolveKimiroAddressName({
    fullName: args.sessionUser.name,
    preferredName: memberProfile?.preferredName,
  });

  const connectorTools: ConnectorWorkflowToolDescriptor[] = [];
  for (const name of connectorBundle.activeToolNames) {
    const definition = connectorBundle.tools[name];
    const mapping = connectorBundle.nameMap.get(name);
    if (!(definition && mapping && "inputSchema" in definition)) {
      continue;
    }
    connectorTools.push({
      description:
        typeof definition.description === "string"
          ? definition.description
          : `Run the ${name} connector action`,
      inputSchema: connectorInputJsonSchema(mapping.toolId),
      name,
      providerId: mapping.providerId,
      toolConfigId: mapping.toolConfigId,
      toolId: mapping.toolId,
    });
  }

  const metadata = assistantRow?.metadata as
    | { modelId?: string }
    | null
    | undefined;
  const allowedModels = new Set(availableModels.map((model) => model.id));
  const requestedModel = resolveCanonicalModelId(
    metadata?.modelId ?? DEFAULT_CHAT_MODEL
  );
  const modelId = allowedModels.has(requestedModel)
    ? requestedModel
    : (availableModels[0]?.id ?? DEFAULT_CHAT_MODEL);

  return {
    citationContext: createSharedCitationContext(),
    input: {
      assistantMessageId: args.assistantMessageId,
      authUser: {
        email: args.sessionUser.email as string,
        id: args.sessionUser.id,
        name: args.sessionUser.name,
        preferredName: kimiroAddressName,
      },
      chatId: args.chatId,
      idempotencyKey: "",
      knowledgeBaseId: null,
      knowledgeBaseName: null,
      llmKeys,
      messages: [],
      modelId,
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      tenantUserId: args.tenantUserId,
      toolConfiguration: {
        connectorTools,
        mcpTools: mcpBundle.descriptors,
        sandboxEnabled: sandboxConfig.enabled,
        sandboxWorkSkillIds: sandboxConfig.workSkillIds,
        webSearchConfig: webSearchConfig?.search?.apiKey
          ? webSearchConfig
          : null,
      },
      userMessageId: "",
      workspacePrompt: workspacePrompt ?? undefined,
    },
    workflowRunId: args.workflowRunId,
  };
}

export async function prepareHeadlessChatWorkflowAccess(args: {
  tenantId: string;
  tenantSlug: string;
  authUserId: string;
  email: string;
  name: string | null;
  chatId: string;
  knowledgeBaseId?: string | null;
  titleSource: string;
  requestFingerprint: string;
  userMessageId: string;
}) {
  if (!isUuid(args.chatId)) {
    throw new ChatbotError("bad_request:api", "Invalid chat id");
  }

  const accessOk = await assertChatApiAccessForTenant({
    tenantId: args.tenantId,
    userEmail: args.email,
    userId: args.authUserId,
  });
  if (accessOk === "forbidden") {
    throw new ChatbotError("forbidden:chat");
  }

  const sessionUser = {
    email: args.email,
    id: args.authUserId,
    name: args.name ?? undefined,
  } as SessionUser;
  const tenantUserId = toTenantUserId(args.authUserId);

  const chat = await withTenantId(args.tenantId, async () => {
    const existing = await getChatById({ id: args.chatId });
    if (existing) {
      if (existing.userId !== tenantUserId) {
        throw new ChatbotError("forbidden:chat");
      }
      if (
        args.knowledgeBaseId !== undefined &&
        args.knowledgeBaseId !== existing.knowledgeBaseId
      ) {
        await updateChatKnowledgeBaseById({
          chatId: args.chatId,
          knowledgeBaseId: args.knowledgeBaseId ?? null,
        });
        return { ...existing, knowledgeBaseId: args.knowledgeBaseId ?? null };
      }
      return existing;
    }

    await saveChat({
      id: args.chatId,
      knowledgeBaseId: args.knowledgeBaseId ?? null,
      title: chatTitleFromMessage({
        id: generateUUID(),
        parts: [{ text: args.titleSource, type: "text" }],
        role: "user",
      }),
      userId: tenantUserId,
    });
    const created = await getChatById({ id: args.chatId });
    if (!created) {
      throw new ChatbotError("bad_request:database", "Failed to save chat");
    }
    return created;
  });

  return {
    chat,
    idempotencyKey: `${args.tenantId}:${args.chatId}:${args.userMessageId}:${args.requestFingerprint}`,
    session: { user: sessionUser },
    sessionUser,
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    tenantUserId,
  };
}
