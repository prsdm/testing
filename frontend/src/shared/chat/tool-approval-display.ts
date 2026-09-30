import { userMessageRequestsSharedDrive } from "@/shared/ai/chat-task-planning";
import {
  type ConnectorActionToolType,
  getConnectorToolCallHeader,
  isConnectorActionToolType,
  type SlackUserLookup,
} from "@/shared/chat/connector-action-tools";
import type { ChatMessage } from "@/shared/types";

function humanizeToolName(toolName: string) {
  return toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

export function getToolApprovalHeadline(
  toolName: string,
  args?: Record<string, unknown>,
  slackUserLookup?: SlackUserLookup
) {
  const connectorType = `tool-${toolName}` as ConnectorActionToolType;
  if (isConnectorActionToolType(connectorType)) {
    const { verb, chip } = getConnectorToolCallHeader({
      input: args,
      isPending: true,
      slackUserLookup,
      toolType: connectorType,
    });
    return chip ? `${verb} ${chip}` : verb;
  }

  const query =
    typeof args?.query === "string" && args.query.trim()
      ? args.query.trim()
      : undefined;
  if (query) {
    return `${humanizeToolName(toolName)}: ${query}`;
  }

  const name =
    typeof args?.name === "string" && args.name.trim()
      ? args.name.trim()
      : undefined;
  if (name) {
    return `${humanizeToolName(toolName)}: ${name}`;
  }

  return humanizeToolName(toolName);
}

export function getToolApprovalWarning(
  toolName: string,
  _args?: Record<string, unknown>,
  userMessageText?: string
) {
  const normalizedUserMessage = userMessageText?.trim() ?? "";
  if (!normalizedUserMessage) {
    return;
  }

  if (
    toolName === "driveCreateSharedDrive" &&
    !userMessageRequestsSharedDrive(normalizedUserMessage)
  ) {
    return "This creates a shared drive (team drive), not a My Drive folder.";
  }

  if (
    toolName === "driveCreateFolder" &&
    userMessageRequestsSharedDrive(normalizedUserMessage)
  ) {
    return "This creates a My Drive folder, not a shared drive.";
  }
}

export function latestUserMessageTextFromChat(
  messages: readonly ChatMessage[]
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text" && typeof part.text === "string"
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}
