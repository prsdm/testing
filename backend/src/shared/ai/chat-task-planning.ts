import type { ModelMessage } from "ai";
import {
  appendUserNudgeToModelMessages,
  resolvePrepareStepUserNudge,
} from "@/shared/ai/chat-agent-nudge";
import { truncateToolResultsInModelMessages } from "@/shared/ai/context-harness/truncate-tool-results";
import type { ChatMessagePart } from "@/shared/types";

const SHARED_DRIVE_PATTERN =
  /\b(shared drive|shared drives|team drive|team drives)\b/i;

const MUTATING_VERB_PATTERN =
  /\b(create|send|make|write|upload|move|delete|update|dm|folder|report)\b/i;

export function userMessageRequestsSharedDrive(text: string): boolean {
  return SHARED_DRIVE_PATTERN.test(text.trim());
}

export function userMessageNeedsTaskPlan(text: string): boolean {
  const normalized = text.trim();
  if (normalized.length < 16 || !MUTATING_VERB_PATTERN.test(normalized)) {
    return false;
  }

  if (
    /\b(one after another|sequentially|in sequence|step by step|each(?: one)?)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  if (/(?:^|\n)\s*\d+[.)]\s+/m.test(normalized)) {
    return true;
  }

  if (/\bthen\b/i.test(normalized) && MUTATING_VERB_PATTERN.test(normalized)) {
    return true;
  }

  const listMatch = normalized.match(
    /\b(?:create|make|add|send|write|upload)\b[^.!?]{0,120}\b(?:and|,)\b/i
  );
  if (listMatch) {
    const commaCount = (normalized.match(/,/g) ?? []).length;
    if (commaCount >= 1 || /\band\b/i.test(normalized)) {
      return true;
    }
  }

  return false;
}

export function latestUserMessageText(messages: ModelMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .filter(
          (part): part is { type: "text"; text: string } =>
            part.type === "text" && typeof part.text === "string"
        )
        .map((part) => part.text)
        .join("\n");
    }
  }
  return "";
}

export function assistantPartsHaveTodoPlan(parts: ChatMessagePart[]): boolean {
  return parts.some((part) => part.type === "tool-todoWrite");
}

export function shouldExposeConnectorTool(args: {
  toolId: string;
  userMessageText: string;
}): boolean {
  if (args.toolId === "driveCreateSharedDrive") {
    return userMessageRequestsSharedDrive(args.userMessageText);
  }
  return true;
}

export function createChatPrepareStep(args: {
  userMessageText: string;
  assistantPartsHaveTodoPlan: boolean;
  assistantParts: ChatMessagePart[];
  todoExecutionNudged?: boolean;
  todoPendingStepsNudged?: boolean;
  isContinuationTurn: boolean;
  onStepStart?: () => void;
}) {
  return ({
    stepNumber,
    steps,
    messages,
  }: {
    stepNumber: number;
    steps: Array<{ toolCalls?: Array<{ toolName: string }> }>;
    messages: ModelMessage[];
  }) => {
    args.onStepStart?.();

    const needsPlan =
      userMessageNeedsTaskPlan(args.userMessageText) &&
      !args.assistantPartsHaveTodoPlan;
    const wroteTodoThisStream = steps.some((step) =>
      (step.toolCalls ?? []).some((call) => call.toolName === "todoWrite")
    );

    const nudge = resolvePrepareStepUserNudge({
      assistantParts: args.assistantParts,
      isContinuationTurn: args.isContinuationTurn,
      stepNumber,
      todoExecutionNudged: args.todoExecutionNudged,
      todoPendingStepsNudged: args.todoPendingStepsNudged,
    });
    const messagesWithNudge =
      nudge && messages.length > 0
        ? appendUserNudgeToModelMessages(messages, nudge)
        : messages;
    const sanitizedMessages =
      truncateToolResultsInModelMessages(messagesWithNudge);

    if (needsPlan && !wroteTodoThisStream && stepNumber === 0) {
      return {
        messages: sanitizedMessages,
        toolChoice: { toolName: "todoWrite", type: "tool" },
      };
    }

    return { messages: sanitizedMessages };
  };
}
