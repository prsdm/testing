"use client";

import { splitTextForComposerMentionHighlight } from "@/lib/chat/room-mention-autocomplete";
import type { KimiroMentionSegment } from "@/shared/chat/kimiro-mention";
import { CHAT_MENTION_COMPOSER_MIRROR_CLASS } from "@/shared/chat/mention-styles";
import { cn } from "@/shared/utils";

export const COMPOSER_MENTION_MIRROR_CLASS =
  "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-foreground";

function MentionMirrorSegments({
  segments,
}: {
  segments: KimiroMentionSegment[];
}) {
  let offset = 0;
  return (
    <>
      {segments.map((segment) => {
        const key = `${segment.kind}-${offset}`;
        offset += segment.value.length;
        return segment.kind === "mention" ? (
          <span className={CHAT_MENTION_COMPOSER_MIRROR_CLASS} key={key}>
            {segment.value}
          </span>
        ) : (
          <span key={key}>{segment.value}</span>
        );
      })}
    </>
  );
}

export function ComposerMentionHighlightMirror({
  className,
  cursor,
  handles,
  text,
}: {
  className?: string;
  cursor: number;
  handles: Set<string>;
  text: string;
}) {
  const segments = splitTextForComposerMentionHighlight({
    cursor,
    handles,
    text,
  });
  const hasMention = segments.some((segment) => segment.kind === "mention");

  if (!text) {
    return null;
  }

  if (!hasMention) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      <MentionMirrorSegments segments={segments} />
    </span>
  );
}

export function composerMentionHighlightEnabled(
  text: string,
  cursor: number,
  handles: Set<string>
) {
  return splitTextForComposerMentionHighlight({ cursor, handles, text }).some(
    (segment) => segment.kind === "mention"
  );
}

export function composerMentionTextareaClassName(enabled: boolean) {
  return cn(
    enabled &&
      "text-transparent caret-foreground selection:bg-primary/20 dark:selection:bg-primary/30"
  );
}
