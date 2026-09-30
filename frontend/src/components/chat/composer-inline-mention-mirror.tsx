"use client";

import { ComposerMentionHighlightMirror } from "@/components/chat/composer-mention-highlight";
import { ConnectorFocusInlineBadge } from "@/components/chat/connector-focus-inline-badge";
import type { ComposerInlineBody } from "@/lib/chat/composer-inline-body";
import { connectorFocusMentionToken } from "@/shared/connectors/composer-connector-focus";
import { cn } from "@/shared/utils";

/** Mirrors inline composer layout with purple @handles (kimiro, members, etc.). */
export function ComposerInlineMentionMirror({
  body,
  className,
  cursor,
  handles,
}: {
  body: ComposerInlineBody;
  className?: string;
  cursor: number;
  handles: Set<string>;
}) {
  let wireOffset = 0;

  return (
    <div className={cn("whitespace-pre-wrap break-words", className)}>
      {body.segments.map((segment) => {
        if (segment.kind === "connector") {
          const tokenLen = connectorFocusMentionToken(segment.focus).length;
          wireOffset += tokenLen;
          return (
            <ConnectorFocusInlineBadge
              className="pointer-events-none invisible"
              focus={segment.focus}
              key={segment.id}
              variant="composer"
            />
          );
        }

        const text = segment.text;
        const segStart = wireOffset;
        const segEnd = wireOffset + text.length;
        const localCursor =
          cursor >= segStart && cursor <= segEnd
            ? cursor - segStart
            : cursor > segEnd
              ? text.length
              : 0;
        wireOffset = segEnd;

        if (!text) {
          return null;
        }

        return (
          <ComposerMentionHighlightMirror
            cursor={localCursor}
            handles={handles}
            key={segment.id}
            text={text}
          />
        );
      })}
    </div>
  );
}
