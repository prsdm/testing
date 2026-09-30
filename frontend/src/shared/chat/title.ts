import type { ChatMessage } from "@/shared/types";
import { getTextFromMessage } from "@/shared/utils";

const MAX_CHAT_TITLE_LENGTH = 60;

export function chatTitleFromMessage(message: ChatMessage) {
  const text = getTextFromMessage(message).replace(/\s+/g, " ").trim();
  if (!text) {
    return "New chat";
  }
  if (text.length <= MAX_CHAT_TITLE_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_CHAT_TITLE_LENGTH - 1).trimEnd()}…`;
}
