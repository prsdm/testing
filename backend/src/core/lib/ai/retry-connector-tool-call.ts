import { executeIdempotentTool } from "@/core/lib/ai/execute-idempotent-tool";
import { buildConnectorToolsForChat } from "@/core/lib/connectors/build-chat-tools";
import { executeConnectorTool } from "@/core/lib/connectors/execute-connector-tool";
import { listChatToolConfigIdsForUser } from "@/core/lib/connectors/list-chat-tool-config-ids";
import { isWriteToolName } from "@/shared/ai/tool-approvals";
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

function isConnectorToolErrorResult(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }
  return undefined;
}

export async function rerunConnectorToolPart(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  workflowRunId: string;
  part: ChatMessagePart;
}): Promise<ChatMessagePart> {
  if (!("toolCallId" in args.part)) {
    throw new Error("Tool call id is missing");
  }
  const toolName = toolNameFromPart(args.part);
  if (!toolName) {
    throw new Error("Tool name is missing");
  }

  const toolConfigIds = await listChatToolConfigIdsForUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  const bundle = await buildConnectorToolsForChat({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    toolConfigIds,
    userId: args.userId,
    workflowRunId: args.workflowRunId,
  });
  const mapping = bundle.nameMap.get(toolName);
  if (!mapping) {
    throw new Error(`Connector tool mapping not found for ${toolName}`);
  }

  const input = toolInputFromPart(args.part);

  const execute = () =>
    executeConnectorTool({
      input,
      providerId: mapping.providerId,
      tenantId: args.tenantId,
      toolConfigId: mapping.toolConfigId,
      toolId: mapping.toolId,
      userId: args.userId,
    });

  const result = await (isWriteToolName(toolName)
    ? executeIdempotentTool({
        execute,
        input,
        tenantId: args.tenantId,
        toolCallId: args.part.toolCallId,
        toolName,
        workflowRunId: args.workflowRunId,
      })
    : execute());

  const errorText = isConnectorToolErrorResult(result);
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
