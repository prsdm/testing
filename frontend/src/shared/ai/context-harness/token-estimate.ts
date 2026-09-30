import type { ModelMessage } from "ai";
import { CHARS_PER_TOKEN_ESTIMATE } from "./constants";

export function estimateTokensFromText(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

function contentToText(content: ModelMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const chunks: string[] = [];
  for (const part of content) {
    if (typeof part !== "object" || part === null) {
      continue;
    }
    if ("type" in part && part.type === "text" && "text" in part) {
      chunks.push(String(part.text));
      continue;
    }
    if ("type" in part && part.type === "tool-result") {
      chunks.push(JSON.stringify(part));
      continue;
    }
    if ("type" in part && part.type === "tool-call") {
      chunks.push(JSON.stringify(part));
      continue;
    }
    if ("type" in part && part.type === "reasoning" && "text" in part) {
      chunks.push(String(part.text));
    }
  }
  return chunks.join("\n");
}

export function estimateModelMessageTokens(message: ModelMessage): number {
  return estimateTokensFromText(contentToText(message.content));
}

export function estimateModelMessagesTokens(messages: ModelMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateModelMessageTokens(message),
    0
  );
}
