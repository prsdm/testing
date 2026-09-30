import type { ToolSet, UIMessage } from "ai";
import type { ChatToolContext } from "@/core/lib/ai/chat-tool-executors";
import {
  readOriginalToolName,
  resolveExecutableToolName,
  withOriginalToolName,
} from "@/core/lib/ai/executable-tool-name";
import { uiPartsToChatParts } from "@/shared/chat/ui-message-parts";
import { buildWorkflowToolPartFromResult } from "@/shared/chat/workflow-tool-parts";
import { ChatbotError } from "@/shared/errors";
import type { ChatMessagePart } from "@/shared/types";

function isToolPart(part: ChatMessagePart): part is ChatMessagePart & {
  type: `tool-${string}`;
  toolCallId: string;
  state: string;
} {
  return (
    part.type.startsWith("tool-") && "toolCallId" in part && "state" in part
  );
}

function isTerminalToolPart(part: ChatMessagePart): boolean {
  if (!isToolPart(part)) {
    return false;
  }
  return (
    part.state === "output-available" ||
    part.state === "output-denied" ||
    part.state === "output-error"
  );
}

function isApprovedPendingExecution(part: ChatMessagePart): boolean {
  if (!isToolPart(part) || part.state !== "approval-responded") {
    return false;
  }
  return part.approval?.approved !== false;
}

function isRejectedPendingClose(part: ChatMessagePart): boolean {
  if (!isToolPart(part)) {
    return false;
  }
  if (part.state === "output-denied") {
    return false;
  }
  if (part.state === "approval-responded") {
    return part.approval?.approved === false;
  }
  return false;
}

function deniedToolPart(
  part: ChatMessagePart,
  reason = "Rejected by user"
): ChatMessagePart {
  return {
    ...part,
    approval:
      "approval" in part && part.approval
        ? { ...part.approval, approved: false, reason }
        : undefined,
    errorText: reason,
    output: {
      reason,
      type: "execution-denied",
    },
    state: "output-denied",
  } as ChatMessagePart;
}

async function executeApprovedToolPart(args: {
  part: ChatMessagePart;
  tools: ToolSet;
  toolsContext: Record<string, ChatToolContext>;
}): Promise<ChatMessagePart> {
  const toolName = resolveExecutableToolName(args.part, args.tools);
  if (!toolName) {
    throw new ChatbotError(
      "bad_request:api",
      `Tool is not available for execution (${readOriginalToolName(args.part) ?? "unknown"}).`
    );
  }

  const tool = args.tools[toolName];
  const execute =
    tool &&
    typeof tool === "object" &&
    "execute" in tool &&
    typeof tool.execute === "function"
      ? tool.execute
      : undefined;
  if (!execute) {
    throw new ChatbotError(
      "bad_request:api",
      `Tool ${toolName} cannot be executed on the server.`
    );
  }

  const toolCallId =
    "toolCallId" in args.part && typeof args.part.toolCallId === "string"
      ? args.part.toolCallId
      : "";
  const input = "input" in args.part ? args.part.input : undefined;
  const context = args.toolsContext[toolName];

  try {
    const result = await execute(input, {
      context,
      messages: [],
      toolCallId,
    } as never);
    const built = buildWorkflowToolPartFromResult({
      result,
      toolArgs:
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : null,
      toolCallId,
      toolName,
    });
    if (!built) {
      return withOriginalToolName(
        {
          ...args.part,
          output: result,
          state: "output-available",
        } as ChatMessagePart,
        toolName
      );
    }
    return withOriginalToolName(built, toolName);
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Tool execution failed";
    const built = buildWorkflowToolPartFromResult({
      errorText,
      result: { error: errorText },
      toolArgs:
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Record<string, unknown>)
          : null,
      toolCallId,
      toolName,
    });
    if (built) {
      return withOriginalToolName(built, toolName);
    }
    return withOriginalToolName(
      {
        ...args.part,
        errorText,
        output: { error: errorText },
        state: "output-error",
      } as ChatMessagePart,
      toolName
    );
  }
}

async function resolveAssistantToolParts(args: {
  parts: ChatMessagePart[];
  tools: ToolSet;
  toolsContext: Record<string, ChatToolContext>;
}): Promise<{ parts: ChatMessagePart[]; changed: boolean }> {
  let changed = false;
  const nextParts: ChatMessagePart[] = [];

  for (const part of args.parts) {
    if (!isToolPart(part)) {
      nextParts.push(part);
      continue;
    }

    if (part.state === "approval-requested") {
      throw new ChatbotError(
        "bad_request:api",
        "Tool approval is still pending for this turn."
      );
    }

    if (isTerminalToolPart(part)) {
      nextParts.push(part);
      continue;
    }

    if (isRejectedPendingClose(part)) {
      changed = true;
      nextParts.push(
        deniedToolPart(
          part,
          part.approval?.reason?.trim() || "Rejected by user"
        )
      );
      continue;
    }

    if (isApprovedPendingExecution(part)) {
      changed = true;
      nextParts.push(
        await executeApprovedToolPart({
          part,
          tools: args.tools,
          toolsContext: args.toolsContext,
        })
      );
      continue;
    }

    nextParts.push(part);
  }

  return { changed, parts: nextParts };
}

function chatPartsToUiParts(parts: ChatMessagePart[]): UIMessage["parts"] {
  return parts as UIMessage["parts"];
}

/** Execute approved tools and close rejected ones before the next model call. */
export async function resolveToolApprovalStep(args: {
  uiMessages: UIMessage[];
  tools: ToolSet;
  toolsContext: Record<string, ChatToolContext>;
}): Promise<{ uiMessages: UIMessage[]; changed: boolean }> {
  const lastAssistantIndex = args.uiMessages.findLastIndex(
    (message) => message.role === "assistant"
  );
  if (lastAssistantIndex < 0) {
    return { changed: false, uiMessages: args.uiMessages };
  }

  const assistant = args.uiMessages[lastAssistantIndex];
  if (!assistant) {
    return { changed: false, uiMessages: args.uiMessages };
  }

  const chatParts = uiPartsToChatParts(assistant.parts);
  if (
    chatParts.some(
      (part) => isToolPart(part) && part.state === "approval-requested"
    )
  ) {
    throw new ChatbotError(
      "bad_request:api",
      "Tool approval is still pending for this turn."
    );
  }
  const hasResolvable = chatParts.some(
    (part) => isApprovedPendingExecution(part) || isRejectedPendingClose(part)
  );
  if (!hasResolvable) {
    return { changed: false, uiMessages: args.uiMessages };
  }

  const { parts, changed } = await resolveAssistantToolParts({
    parts: chatParts,
    tools: args.tools,
    toolsContext: args.toolsContext,
  });

  if (!changed) {
    return { changed: false, uiMessages: args.uiMessages };
  }

  const nextMessages = [...args.uiMessages];
  nextMessages[lastAssistantIndex] = {
    ...assistant,
    parts: chatPartsToUiParts(parts),
  };
  return { changed: true, uiMessages: nextMessages };
}
