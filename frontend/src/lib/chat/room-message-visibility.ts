import type { ChatRunStatus } from "@/lib/chat/chat-helpers";
import { sortChatMessagesChronologically } from "@/lib/chat/message-order";
import { isWorkflowRunStopped } from "@/lib/chat/stopped-workflow-runs";
import { isEmptyAssistantMessage } from "@/lib/chat/workflow-message-bridge";
import type { ChatMessage } from "@/shared/types";

function isInFlightWorkflowRunStatus(
  status: string | undefined
): status is "pending" | "running" | "suspended" {
  return status === "pending" || status === "running" || status === "suspended";
}

/** Empty assistant row at turn start — hidden until partial text is persisted for the room. */
export function isInProgressRoomAssistantPlaceholder(
  message: ChatMessage
): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  if (!isEmptyAssistantMessage(message)) {
    return false;
  }
  const status = message.metadata?.workflowRunStatus;
  return status === "pending" || status === "running" || status === "suspended";
}

export function filterMultiplayerMainTimelineMessages(
  messages: ChatMessage[]
): ChatMessage[] {
  return sortChatMessagesChronologically(
    messages.filter(
      (message) =>
        !message.threadRootMessageId &&
        !isInProgressRoomAssistantPlaceholder(message)
    )
  );
}

/** Treat in-flight Kimiro turns as streaming for room peers (not only the initiator). */
export function isRoomPeerAssistantStreaming(args: {
  chatId?: string;
  isMultiplayerRoom: boolean;
  isLastVisible: boolean;
  message: ChatMessage;
  workflowRunActive: boolean;
}): boolean {
  if (!(args.isMultiplayerRoom && args.isLastVisible)) {
    return false;
  }
  if (!args.workflowRunActive) {
    return false;
  }
  if (args.message.role !== "assistant") {
    return false;
  }
  const runStatus = args.message.metadata?.workflowRunStatus;
  if (!isInFlightWorkflowRunStatus(runStatus)) {
    return false;
  }
  const runId = args.message.metadata?.workflowRunId;
  if (
    args.chatId &&
    typeof runId === "string" &&
    isWorkflowRunStopped(args.chatId, runId)
  ) {
    return false;
  }
  return true;
}

export function shouldShowPendingAssistantThinking(args: {
  activeRunComposerThreadRootMessageId: string | null | undefined;
  messages: ChatMessage[];
  status: ChatRunStatus;
  viewThreadRootMessageId: string | null;
}): boolean {
  if (args.messages.at(-1)?.role !== "user") {
    return false;
  }
  const workflowRunActive =
    args.status === "submitted" || args.status === "streaming";
  if (!workflowRunActive) {
    return false;
  }
  const activeScope = args.activeRunComposerThreadRootMessageId;
  if (activeScope === undefined) {
    return true;
  }
  if (activeScope === null) {
    return args.viewThreadRootMessageId === null;
  }
  return activeScope === args.viewThreadRootMessageId;
}

export function isAssistantMessageStreamingForViewer(args: {
  chatId: string;
  isMultiplayerRoom: boolean;
  isLastVisible: boolean;
  message: ChatMessage;
  status: ChatRunStatus;
  workflowRunActive: boolean;
  awaitingPostDenialContinuation: boolean;
}): boolean {
  const runId = args.message.metadata?.workflowRunId;
  if (typeof runId === "string" && isWorkflowRunStopped(args.chatId, runId)) {
    return false;
  }
  const persistedRunStatus = args.message.metadata?.workflowRunStatus;
  if (
    persistedRunStatus === "cancelled" ||
    persistedRunStatus === "failed" ||
    persistedRunStatus === "success"
  ) {
    return false;
  }
  if (
    args.isLastVisible &&
    args.message.role === "assistant" &&
    args.workflowRunActive &&
    args.message.metadata?.workflowRunStatus !== "suspended"
  ) {
    return true;
  }
  if (
    args.isLastVisible &&
    args.message.role === "assistant" &&
    args.awaitingPostDenialContinuation
  ) {
    return true;
  }
  return isRoomPeerAssistantStreaming({
    chatId: args.chatId,
    isLastVisible: args.isLastVisible,
    isMultiplayerRoom: args.isMultiplayerRoom,
    message: args.message,
    workflowRunActive: args.workflowRunActive,
  });
}

export function filterMultiplayerThreadMessages(
  messages: ChatMessage[],
  options?: { threadRootMessageId?: string }
): ChatMessage[] {
  return sortChatMessagesChronologically(
    messages.filter(
      (message) => !isInProgressRoomAssistantPlaceholder(message)
    ),
    options
  );
}
