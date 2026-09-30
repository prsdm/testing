"use client";

import { splitTextWithKimiroMentions } from "@/shared/chat/kimiro-mention";
import { CHAT_MENTION_HIGHLIGHT_CLASS } from "@/shared/chat/mention-styles";

export function UserMessageText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = splitTextWithKimiroMentions(text);
  const hasMention = segments.some((segment) => segment.kind === "mention");

  if (!hasMention) {
    return <span className={className}>{text}</span>;
  }

  let offset = 0;
  return (
    <span className={className}>
      {segments.map((segment) => {
        const key = `${segment.kind}-${offset}`;
        offset += segment.value.length;
        return segment.kind === "mention" ? (
          <span className={CHAT_MENTION_HIGHLIGHT_CLASS} key={key}>
            {segment.value}
          </span>
        ) : (
          <span key={key}>{segment.value}</span>
        );
      })}
    </span>
  );
}
