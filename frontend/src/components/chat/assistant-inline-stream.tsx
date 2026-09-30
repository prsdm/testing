"use client";

import { selectAssistantPartOrder } from "@/shared/chat/assistant-message-parts";
import type { CitedDocument } from "@/shared/search/citations";
import type { ChatMessage } from "@/shared/types";
import { Shimmer } from "../ai-elements/shimmer";
import { AssistantMessagePartList } from "./assistant-message-part-list";

type AssistantInlineStreamProps = {
  assistantMessageId?: string;
  messageParts: ChatMessage["parts"];
  isMessageStreaming: boolean;
  isReadonly: boolean;
  messageCitations: Record<number, CitedDocument>;
  artifactTitle: string;
  artifactKind: "text" | "code" | "sheet";
};

export function AssistantInlineStream({
  assistantMessageId,
  messageParts,
  isMessageStreaming,
  isReadonly,
  messageCitations,
  artifactTitle,
  artifactKind,
}: AssistantInlineStreamProps) {
  if (
    selectAssistantPartOrder(messageParts).length === 0 &&
    isMessageStreaming
  ) {
    return (
      <div className="py-0.5">
        <Shimmer as="span" className="font-medium text-sm" duration={1}>
          Thinking
        </Shimmer>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 md:gap-2">
      <AssistantMessagePartList
        artifactKind={artifactKind}
        artifactTitle={artifactTitle}
        assistantMessageId={assistantMessageId}
        isMessageStreaming={isMessageStreaming}
        isReadonly={isReadonly}
        messageCitations={messageCitations}
        messageParts={messageParts}
      />
    </div>
  );
}
