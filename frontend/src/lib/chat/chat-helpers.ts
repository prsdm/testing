import type { ChatMessage } from "@/shared/types";

export type ChatRunStatus = "ready" | "submitted" | "streaming" | "error";

export type ChatSendMessage = (message: {
  role?: "user";
  parts: ChatMessage["parts"];
  metadata?: ChatMessage["metadata"];
  id?: string;
  replaceFromMessageId?: string;
  threadRootMessageId?: string | null;
}) => void | Promise<void>;

export type ChatSetMessages = (
  messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])
) => void;

export type ChatHelpers = {
  messages: ChatMessage[];
  setMessages: ChatSetMessages;
  sendMessage: ChatSendMessage;
  status: ChatRunStatus;
  stop: () => void | Promise<void>;
  regenerate: () => void;
};
