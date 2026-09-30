"use client";

import { ThinkingCard } from "./thinking-card";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
  embedded?: boolean;
};

export function MessageReasoning({
  isLoading,
  reasoning,
  embedded = false,
}: MessageReasoningProps) {
  if (embedded) {
    if (!reasoning.trim() && isLoading) {
      return <p className="text-muted-foreground text-sm">Thinking…</p>;
    }

    if (!reasoning.trim()) {
      return null;
    }

    return (
      <ThinkingCard content={reasoning} defaultOpen isStreaming={isLoading} />
    );
  }

  return (
    <ThinkingCard
      content={reasoning}
      defaultOpen={false}
      isStreaming={isLoading}
    />
  );
}
