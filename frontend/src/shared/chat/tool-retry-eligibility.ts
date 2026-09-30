import { isWriteToolName } from "@/shared/ai/tool-approvals";
import { isConnectorActionToolType } from "@/shared/chat/connector-action-tools";
import type { ChatMessage, ChatMessagePart } from "@/shared/types";

/** Rerun only on the active assistant turn — not after the user has sent a follow-up. */
export function isAssistantMessageEligibleForToolRetry(
  messages: ChatMessage[],
  assistantMessageId: string
): boolean {
  const assistantIndex = messages.findIndex(
    (message) =>
      message.id === assistantMessageId && message.role === "assistant"
  );
  if (assistantIndex < 0) {
    return false;
  }

  for (let index = assistantIndex + 1; index < messages.length; index += 1) {
    if (messages[index]?.role === "user") {
      return false;
    }
  }

  return true;
}

function toolNameFromPart(part: ChatMessagePart): string | undefined {
  if (!part.type.startsWith("tool-")) {
    return undefined;
  }
  return part.type.slice("tool-".length);
}

function partHasOutputError(part: ChatMessagePart): boolean {
  if (!("state" in part)) {
    return false;
  }
  if (part.state === "output-error") {
    return true;
  }
  if (!("output" in part) || !part.output || typeof part.output !== "object") {
    return false;
  }
  const output = part.output as Record<string, unknown>;
  return typeof output.error === "string" && output.error.trim().length > 0;
}

/** Finished tool rows that can be retried (connectors, search, charts, etc.). */
export function isToolTerminalForRetry(part: ChatMessagePart): boolean {
  if (!part.type.startsWith("tool-") || !("state" in part)) {
    return false;
  }
  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded" ||
    part.state === "input-available" ||
    part.state === "input-streaming"
  ) {
    return false;
  }
  return (
    part.state === "output-available" ||
    part.state === "output-denied" ||
    part.state === "output-error"
  );
}

/** @deprecated Use {@link isToolTerminalForRetry}. */
export function isConnectorToolTerminalForRetry(
  part: ChatMessagePart
): boolean {
  return isToolTerminalForRetry(part) && isConnectorActionToolType(part.type);
}

/** Label for the retry action on a finished tool row. */
export function toolRetryLabel(part: ChatMessagePart): string {
  if (
    "state" in part &&
    part.state === "output-available" &&
    !partHasOutputError(part)
  ) {
    return "Run again";
  }
  return "Retry";
}

/** Whether to show Retry / Run again for a tool row. */
export function shouldOfferToolRetry(part: ChatMessagePart): boolean {
  if (!isToolTerminalForRetry(part)) {
    return false;
  }
  const toolName = toolNameFromPart(part);
  if (!toolName || !("state" in part)) {
    return false;
  }
  if (
    part.state === "output-denied" ||
    part.state === "output-error" ||
    partHasOutputError(part)
  ) {
    return true;
  }
  return part.state === "output-available";
}

/** @deprecated Use {@link shouldOfferToolRetry}. */
export function shouldOfferConnectorToolRetry(part: ChatMessagePart): boolean {
  if (!shouldOfferToolRetry(part)) {
    return false;
  }
  if (!("state" in part)) {
    return false;
  }
  const toolName = toolNameFromPart(part);
  if (!toolName || !isConnectorActionToolType(part.type)) {
    return false;
  }
  if (
    part.state === "output-denied" ||
    part.state === "output-error" ||
    partHasOutputError(part)
  ) {
    return true;
  }
  return isWriteToolName(toolName);
}

/** Connector writes go through approval on retry; everything else re-executes immediately. */
export function toolRetryNeedsApproval(toolName: string): boolean {
  return (
    isConnectorActionToolType(`tool-${toolName}`) && isWriteToolName(toolName)
  );
}
