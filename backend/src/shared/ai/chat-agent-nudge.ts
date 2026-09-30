import type { ModelMessage } from "ai";
import { buildStepBudgetNudge } from "@/shared/ai/chat-agent-budget";
import { getLatestTodoPart } from "@/shared/chat/assistant-message-parts";
import {
  assistantTurnNeedsPendingTodoContinuation,
  assistantTurnNeedsTodoExecutionContinuation,
} from "@/shared/chat/assistant-turn-continuation";
import { assistantTurnAwaitingPostUserRejectionContinuation } from "@/shared/chat/denied-tool-suffix";
import type { TodoItem } from "@/shared/chat/todo-types";
import type { ChatMessagePart } from "@/shared/types";

export function persistedTodoNudgeMetadata(args: {
  attempted: {
    todoExecutionNudged?: boolean;
    todoPendingStepsNudged?: boolean;
  };
  finishReason?: string;
  isAborted: boolean;
}): {
  todoExecutionNudged?: boolean;
  todoPendingStepsNudged?: boolean;
} {
  if (args.isAborted || args.finishReason === "error") {
    return {};
  }
  return {
    ...(args.attempted.todoExecutionNudged === true
      ? { todoExecutionNudged: true }
      : {}),
    ...(args.attempted.todoPendingStepsNudged === true
      ? { todoPendingStepsNudged: true }
      : {}),
  };
}

function openTodoStepLabels(todos: TodoItem[]): string[] {
  return todos
    .filter(
      (todo) => todo.status === "pending" || todo.status === "in_progress"
    )
    .map((todo) =>
      todo.status === "in_progress" ? todo.activeForm : todo.content
    );
}

export function buildTodoExecutionNudge(): string {
  return "Your task plan is ready but no mutating tool has run yet. Update todoWrite if needed, then execute the first pending step with the appropriate connector tool.";
}

export function buildPendingTodoStepsNudge(todos: TodoItem[]): string {
  const openSteps = openTodoStepLabels(todos);
  const list =
    openSteps.length > 0 ? openSteps.join(", ") : "remaining planned steps";
  return `Open task plan steps remain (${list}). Continue with the next pending step: re-call todoWrite, run the mutating tool, then finish or skip every step before your final answer.`;
}

export function buildPostUserRejectionNudge(): string {
  return "The user rejected the most recent write approval that still needs handling. Mark only that rejected step skipped in todoWrite, explain briefly, then continue with the next pending step. Do not mark already-completed steps as skipped. Do not request the same tool with the same arguments again.";
}

export function resolvePrepareStepUserNudge(args: {
  stepNumber: number;
  assistantParts: ChatMessagePart[];
  todoExecutionNudged?: boolean;
  todoPendingStepsNudged?: boolean;
  isContinuationTurn: boolean;
}): string | null {
  const segments: string[] = [];
  const budgetNudge = buildStepBudgetNudge(args.stepNumber);
  if (budgetNudge) {
    segments.push(budgetNudge);
  }

  if (args.stepNumber === 0 && args.isContinuationTurn) {
    if (
      assistantTurnAwaitingPostUserRejectionContinuation(args.assistantParts)
    ) {
      segments.push(buildPostUserRejectionNudge());
    }
    if (
      !args.todoExecutionNudged &&
      assistantTurnNeedsTodoExecutionContinuation(args.assistantParts)
    ) {
      segments.push(buildTodoExecutionNudge());
    }
    if (
      !args.todoPendingStepsNudged &&
      assistantTurnNeedsPendingTodoContinuation(args.assistantParts)
    ) {
      const latestTodo = getLatestTodoPart(args.assistantParts);
      if (latestTodo) {
        segments.push(buildPendingTodoStepsNudge(latestTodo.todos));
      }
    }
  }

  return segments.length > 0 ? segments.join("\n\n") : null;
}

export function appendUserNudgeToModelMessages(
  messages: ModelMessage[],
  nudge: string
): ModelMessage[] {
  return [...messages, { content: nudge, role: "user" }];
}
