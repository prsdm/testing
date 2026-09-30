import type { DBMessage } from "@/core/lib/db/schema";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import type { ChatMessage, MessageMetadata } from "@/shared/types";

export function serializeMessageMetadata(
  metadata: MessageMetadata | undefined | null
): MessageMetadata | null {
  if (!metadata) {
    return null;
  }

  const serialized: MessageMetadata = {};
  if (metadata.createdAt) {
    serialized.createdAt = metadata.createdAt;
  }
  if (metadata.editedAt) {
    serialized.editedAt = metadata.editedAt;
  }
  if (metadata.agentId) {
    serialized.agentId = metadata.agentId;
  }
  if (metadata.agentSlug) {
    serialized.agentSlug = metadata.agentSlug;
  }
  if (metadata.agentName) {
    serialized.agentName = metadata.agentName;
  }
  if (metadata.agentIconColor !== undefined) {
    serialized.agentIconColor = metadata.agentIconColor;
  }
  if (metadata.authorAuthUserId) {
    serialized.authorAuthUserId = metadata.authorAuthUserId;
  }
  if (metadata.authorDisplayName) {
    serialized.authorDisplayName = metadata.authorDisplayName;
  }
  if (metadata.authorEmail) {
    serialized.authorEmail = metadata.authorEmail;
  }
  if (metadata.authorImage !== undefined) {
    serialized.authorImage = metadata.authorImage;
  }
  if (metadata.connectCtas && metadata.connectCtas.length > 0) {
    serialized.connectCtas = metadata.connectCtas.map((cta) => ({
      connectLabel: cta.connectLabel,
      connectUrl: cta.connectUrl,
      displayName: cta.displayName,
      integrationKey: cta.integrationKey,
    }));
  }
  if (metadata.documentSelection) {
    serialized.documentSelection = {
      documentId: metadata.documentSelection.documentId,
      text: metadata.documentSelection.text,
      title: metadata.documentSelection.title,
    };
  }
  if (metadata.composerText) {
    serialized.composerText = metadata.composerText;
  }
  if (metadata.composerConnectorFocus) {
    serialized.composerConnectorFocus = metadata.composerConnectorFocus;
  }
  if (metadata.composerConnectorFocuses?.length) {
    serialized.composerConnectorFocuses = metadata.composerConnectorFocuses;
  }
  if (metadata.composerInlineBody?.segments?.length) {
    serialized.composerInlineBody = metadata.composerInlineBody;
  }
  if (metadata.workflowRunId) {
    serialized.workflowRunId = metadata.workflowRunId;
  }
  if (metadata.workflowRunStatus) {
    serialized.workflowRunStatus = metadata.workflowRunStatus;
  }
  if (metadata.pendingToolApproval) {
    serialized.pendingToolApproval = {
      toolCallId: metadata.pendingToolApproval.toolCallId,
      toolName: metadata.pendingToolApproval.toolName,
      ...(metadata.pendingToolApproval.args
        ? { args: metadata.pendingToolApproval.args }
        : {}),
      ...(metadata.pendingToolApproval.approvalId
        ? { approvalId: metadata.pendingToolApproval.approvalId }
        : {}),
    };
  }
  if (metadata.modelId) {
    serialized.modelId = metadata.modelId;
  }
  if (metadata.replyToMessageId) {
    serialized.replyToMessageId = metadata.replyToMessageId;
  }
  if (metadata.usageEventId) {
    serialized.usageEventId = metadata.usageEventId;
  }
  if (metadata.threadTags?.length) {
    serialized.threadTags = metadata.threadTags.map((topic) => ({
      color: topic.color,
      label: topic.label,
    }));
  }
  if (metadata.threadTitle?.trim()) {
    serialized.threadTitle = metadata.threadTitle.trim();
  }

  return Object.keys(serialized).length > 0 ? serialized : null;
}

/** Enough to render connector chips for all viewers (no per-user bootstrap). */
export function messageMetadataHasComposerDisplay(
  metadata: MessageMetadata | null | undefined
): boolean {
  if (!metadata) {
    return false;
  }
  if (
    metadata.composerInlineBody?.segments?.some(
      (segment) => segment.kind === "connector"
    )
  ) {
    return true;
  }
  if (metadata.composerConnectorFocuses?.length) {
    return true;
  }
  if (metadata.composerConnectorFocus) {
    return true;
  }
  return false;
}

export function mergeUserMessageMetadataForPersist(args: {
  createdAt: string;
  existing?: MessageMetadata | null;
  incoming?: MessageMetadata | null;
  roomAuthor?: Pick<
    MessageMetadata,
    "authorAuthUserId" | "authorDisplayName" | "authorEmail" | "authorImage"
  > | null;
  roomTurn?: boolean;
  wireText?: string;
}): MessageMetadata | null {
  const merged: MessageMetadata = {
    ...(args.existing ?? {}),
    ...(args.incoming ?? {}),
    agentSlug:
      args.incoming?.agentSlug ??
      args.existing?.agentSlug ??
      DEFAULT_COMPOSER_ASSISTANT_SLUG,
    createdAt: args.createdAt,
    ...(args.roomAuthor ?? {}),
  };
  if (args.roomTurn && args.wireText?.trim()) {
    merged.composerText =
      args.incoming?.composerText?.trim() ||
      args.existing?.composerText?.trim() ||
      args.wireText.trim();
  }
  return serializeMessageMetadata(merged);
}

export function resolveAssistantAgentMetadata(args: {
  assistantMetadata?: MessageMetadata | null;
  userMetadata?: MessageMetadata | null;
}): MessageMetadata {
  const fromAssistant = args.assistantMetadata ?? {};
  if (fromAssistant.agentSlug) {
    return fromAssistant;
  }

  const fromUser = args.userMetadata ?? {};
  if (fromUser.agentSlug) {
    return {
      ...fromAssistant,
      agentIconColor: fromUser.agentIconColor,
      agentId: fromUser.agentId,
      agentName: fromUser.agentName,
      agentSlug: fromUser.agentSlug,
    };
  }

  return {
    ...fromAssistant,
    agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
  };
}

export function toPersistedDbMessage(args: {
  chatId: string;
  currentMessage: ChatMessage;
  userMessageMetadata?: MessageMetadata | null;
}): DBMessage {
  const metadata =
    args.currentMessage.role === "assistant"
      ? serializeMessageMetadata(
          resolveAssistantAgentMetadata({
            assistantMetadata: args.currentMessage.metadata,
            userMetadata: args.userMessageMetadata,
          })
        )
      : serializeMessageMetadata(args.currentMessage.metadata);

  return {
    attachments: [],
    chatId: args.chatId,
    createdAt: new Date(),
    id: args.currentMessage.id,
    metadata,
    parts: args.currentMessage.parts,
    role: args.currentMessage.role,
    threadRootMessageId: args.currentMessage.threadRootMessageId ?? null,
  };
}
