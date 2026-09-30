"use client";

import { getLatestChatTodoPlan } from "@/shared/chat/assistant-message-parts";
import type { ChatMessage } from "@/shared/types";
import { TodoListCard } from "./todo-list-card";

export function ComposerTaskPanel({ messages }: { messages: ChatMessage[] }) {
  const plan = getLatestChatTodoPlan(messages);
  if (!plan) {
    return null;
  }

  return <TodoListCard key={plan.messageId} todos={plan.todos} />;
}
