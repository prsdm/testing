import type { ToolExecutionOptions } from "ai";
import {
  type ChatToolContext,
  createChartChatTool,
  knowledgeBaseSearchChatTool,
  listKnowledgeBasesChatTool,
  peopleSearchChatTool,
  todoWriteChatTool,
  webSearchChatTool,
} from "@/core/lib/ai/chat-tool-executors";
import { executeIdempotentTool } from "@/core/lib/ai/execute-idempotent-tool";
import { rerunConnectorToolPart } from "@/core/lib/ai/retry-connector-tool-call";
import { isWriteToolName } from "@/shared/ai/tool-approvals";
import { isConnectorActionToolType } from "@/shared/chat/connector-action-tools";
import {
  buildWorkflowToolPartFromResult,
  normalizeStoredToolPart,
} from "@/shared/chat/workflow-tool-parts";
import type { ChatMessagePart } from "@/shared/types";

function toolNameFromPart(part: ChatMessagePart): string | undefined {
  if (!part.type.startsWith("tool-")) {
    return undefined;
  }
  return part.type.slice("tool-".length);
}

function toolInputFromPart(part: ChatMessagePart): Record<string, unknown> {
  if (
    "input" in part &&
    part.input &&
    typeof part.input === "object" &&
    !Array.isArray(part.input)
  ) {
    return part.input as Record<string, unknown>;
  }
  return {};
}

function isToolErrorResult(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  return undefined;
}

async function rerunBuiltinToolPart(args: {
  toolContext: ChatToolContext;
  part: ChatMessagePart;
}): Promise<ChatMessagePart> {
  if (!("toolCallId" in args.part)) {
    throw new Error("Tool call id is missing");
  }
  const toolName = toolNameFromPart(args.part);
  if (!toolName) {
    throw new Error("Tool name is missing");
  }

  const input = toolInputFromPart(args.part);
  const options: ToolExecutionOptions<ChatToolContext> = {
    context: args.toolContext,
    messages: [],
    toolCallId: args.part.toolCallId,
  };

  let result: unknown;
  switch (toolName) {
    case "webSearch":
      result = await webSearchChatTool(
        { query: String(input.query ?? "") },
        options
      );
      break;
    case "sourceSearch":
    case "knowledgeBaseSearch":
    case "projectSearch":
      result = await knowledgeBaseSearchChatTool(
        {
          knowledgeBaseId:
            typeof input.knowledgeBaseId === "string"
              ? input.knowledgeBaseId
              : typeof input.projectId === "string"
                ? input.projectId
                : undefined,
          knowledgeBaseName:
            typeof input.knowledgeBaseName === "string"
              ? input.knowledgeBaseName
              : typeof input.projectName === "string"
                ? input.projectName
                : undefined,
          query: String(input.query ?? ""),
        },
        options
      );
      break;
    case "peopleSearch":
      result = await peopleSearchChatTool(
        { query: String(input.query ?? "") },
        options
      );
      break;
    case "listKnowledgeBases":
    case "listProjects":
      result = await listKnowledgeBasesChatTool({}, options);
      break;
    case "todoWrite":
      result = todoWriteChatTool(
        input as Parameters<typeof todoWriteChatTool>[0],
        options
      );
      break;
    default:
      throw new Error(`Tool ${toolName} cannot be rerun`);
  }

  const errorText = isToolErrorResult(result);
  const rebuilt =
    buildWorkflowToolPartFromResult({
      errorText,
      result,
      toolArgs: input,
      toolCallId: args.part.toolCallId,
      toolName,
    }) ?? args.part;

  return normalizeStoredToolPart(rebuilt);
}

export async function rerunToolPart(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  workflowRunId: string;
  toolContext: ChatToolContext;
  part: ChatMessagePart;
}): Promise<ChatMessagePart> {
  const toolName = toolNameFromPart(args.part);
  if (!toolName) {
    throw new Error("Tool name is missing");
  }

  if (isConnectorActionToolType(args.part.type)) {
    return await rerunConnectorToolPart({
      part: args.part,
      tenantId: args.tenantId,
      tenantSlug: args.tenantSlug,
      userId: args.userId,
      workflowRunId: args.workflowRunId,
    });
  }

  const input = toolInputFromPart(args.part);
  if (
    isWriteToolName(toolName) &&
    toolName === "createChart" &&
    "toolCallId" in args.part
  ) {
    const toolCallId = args.part.toolCallId;
    const execute = async () =>
      createChartChatTool(input as Parameters<typeof createChartChatTool>[0], {
        context: args.toolContext,
        messages: [],
        toolCallId,
      });
    const result = await executeIdempotentTool({
      execute,
      input,
      tenantId: args.tenantId,
      toolCallId,
      toolName,
      workflowRunId: args.workflowRunId,
    });
    const errorText = isToolErrorResult(result);
    const rebuilt =
      buildWorkflowToolPartFromResult({
        errorText,
        result,
        toolArgs: input,
        toolCallId: args.part.toolCallId,
        toolName,
      }) ?? args.part;
    return normalizeStoredToolPart(rebuilt);
  }

  return await rerunBuiltinToolPart({
    part: args.part,
    toolContext: args.toolContext,
  });
}
