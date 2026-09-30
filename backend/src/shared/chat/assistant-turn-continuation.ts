import { isWriteToolName } from "@/shared/ai/tool-approvals";
import { hasAssistantAnswerText } from "@/shared/chat/activity-parts";
import { getLatestTodoPart } from "@/shared/chat/assistant-message-parts";
import { assistantTurnAwaitingPostDenialContinuation } from "@/shared/chat/denied-tool-suffix";
import { todosAllSettled } from "@/shared/chat/todo-types";
import { pendingToolApprovalFromParts } from "@/shared/chat/ui-message-parts";
import type { ChatMessagePart } from "@/shared/types";

function hasIncompleteToolCall(parts: ChatMessagePart[]): boolean {
  return parts.some(
    (part) =>
      part.type.startsWith("tool-") &&
      "state" in part &&
      (part.state === "input-streaming" || part.state === "input-available")
  );
}

function hasMutatingToolAttempt(parts: ChatMessagePart[]): boolean {
  return parts.some((part) => {
    if (!part.type.startsWith("tool-") || part.type === "tool-todoWrite") {
      return false;
    }
    const toolName = part.type.slice("tool-".length);
    return isWriteToolName(toolName);
  });
}

/** Plan exists but no mutating tool ran yet — model sometimes stops after todoWrite. */
export function assistantTurnNeedsTodoExecutionContinuation(
  parts: ChatMessagePart[]
): boolean {
  if (pendingToolApprovalFromParts(parts)) {
    return false;
  }
  const latestTodo = getLatestTodoPart(parts);
  if (!latestTodo || todosAllSettled(latestTodo.todos)) {
    return false;
  }
  if (hasMutatingToolAttempt(parts)) {
    return false;
  }
  return latestTodo.todos.some(
    (todo) => todo.status === "pending" || todo.status === "in_progress"
  );
}

/** Model finished with text while actionable todo steps remain. */
export function assistantTurnNeedsPendingTodoContinuation(
  parts: ChatMessagePart[]
): boolean {
  if (pendingToolApprovalFromParts(parts)) {
    return false;
  }
  const latestTodo = getLatestTodoPart(parts);
  if (!latestTodo || todosAllSettled(latestTodo.todos)) {
    return false;
  }
  const hasOpenSteps = latestTodo.todos.some(
    (todo) => todo.status === "pending" || todo.status === "in_progress"
  );
  if (!hasOpenSteps) {
    return false;
  }
  if (!hasMutatingToolAttempt(parts)) {
    return false;
  }
  return hasAssistantAnswerText(parts, false);
}

/** True when the assistant turn still needs another model step (no final answer yet). */
export function assistantTurnNeedsContinuation(
  parts: ChatMessagePart[],
  options?: {
    todoExecutionNudged?: boolean;
    todoPendingStepsNudged?: boolean;
  }
): boolean {
  if (pendingToolApprovalFromParts(parts)) {
    return false;
  }
  if (hasIncompleteToolCall(parts)) {
    return false;
  }
  if (assistantTurnAwaitingPostDenialContinuation(parts)) {
    return true;
  }
  if (
    !options?.todoExecutionNudged &&
    assistantTurnNeedsTodoExecutionContinuation(parts)
  ) {
    return true;
  }
  if (
    !options?.todoPendingStepsNudged &&
    assistantTurnNeedsPendingTodoContinuation(parts)
  ) {
    return true;
  }
  if (hasAssistantAnswerText(parts, false)) {
    return false;
  }
  if (
    parts.some(
      (part) =>
        part.type.startsWith("tool-") &&
        "state" in part &&
        part.state === "approval-responded" &&
        part.approval?.approved !== false
    )
  ) {
    return true;
  }

  const toolParts = parts.filter(
    (part): part is ChatMessagePart & { state: string } =>
      part.type.startsWith("tool-") && "state" in part
  );
  if (toolParts.length === 0) {
    return false;
  }

  return toolParts.some(
    (part) =>
      part.state === "output-available" ||
      part.state === "output-denied" ||
      part.state === "output-error"
  );
}
