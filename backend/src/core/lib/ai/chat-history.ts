import type { ModelMessage } from "ai";
import { truncateContextForLlm } from "@/shared/ai/context-harness/truncate-context-for-llm";
import type { ChatMessage } from "@/shared/types";
import { getTextFromMessage } from "@/shared/utils";

function priorPassagesFromMessage(message: ChatMessage): string {
  const chunks: string[] = [];
  for (const part of message.parts) {
    if (
      !("output" in part) ||
      !part.output ||
      typeof part.output !== "object"
    ) {
      continue;
    }
    const output = part.output as { contextForLlm?: unknown };
    if (
      typeof output.contextForLlm === "string" &&
      output.contextForLlm.trim()
    ) {
      chunks.push(output.contextForLlm.trim());
    }
  }
  return chunks.map((chunk) => truncateContextForLlm(chunk)).join("\n\n");
}

const KIMIRO_SPEAKER_LABEL = "Kimiro";

export type BuildChatHistoryOptions = {
  /** Prefix human and Kimiro lines with `[Display name]:` for multiplayer rooms. */
  labelRoomSpeakers?: boolean;
};

function roomSpeakerLabel(message: ChatMessage): string | null {
  if (message.role === "assistant") {
    return KIMIRO_SPEAKER_LABEL;
  }
  if (message.role === "user") {
    const author = message.metadata?.authorDisplayName?.trim();
    return author || "Member";
  }
  return null;
}

function withRoomSpeakerLabel(text: string, label: string | null): string {
  if (!label) {
    return text;
  }
  return `[${label}]: ${text}`;
}

export function formatRoomSpeakerMessageContent(
  message: ChatMessage,
  options?: BuildChatHistoryOptions
): string {
  const text = getTextFromMessage(message).trim();
  if (message.role === "assistant") {
    const passages = priorPassagesFromMessage(message);
    const body = passages
      ? `${text}\n\n## Prior search passages\n\n${passages}`
      : text;
    return options?.labelRoomSpeakers
      ? withRoomSpeakerLabel(body, roomSpeakerLabel(message))
      : body;
  }
  if (message.role === "user") {
    return options?.labelRoomSpeakers
      ? withRoomSpeakerLabel(text, roomSpeakerLabel(message))
      : text;
  }
  return text;
}

export function buildChatHistory(
  messages: ChatMessage[],
  options?: BuildChatHistoryOptions
): ModelMessage[] {
  const history = messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant"
    )
    .map((message) => {
      const content = formatRoomSpeakerMessageContent(message, options);
      if (message.role === "user") {
        return { content, role: "user" as const };
      }
      return {
        content,
        role: "assistant" as const,
      };
    })
    .filter((message) => message.content.trim().length > 0);
  return history as ModelMessage[];
}
