"use client";

import { ConnectorFocusInlineBadge } from "@/components/chat/connector-focus-inline-badge";
import { UserMessageText } from "@/components/chat/user-message-text";
import type { ComposerInlineBody } from "@/lib/chat/composer-inline-body";

export function UserMessageInlineBody({
  body,
  className,
}: {
  body: ComposerInlineBody;
  className?: string;
}) {
  return (
    <span className={className}>
      {body.segments.map((segment) => {
        if (segment.kind === "connector") {
          return (
            <ConnectorFocusInlineBadge
              className="align-baseline"
              focus={segment.focus}
              key={segment.id}
              variant="message"
            />
          );
        }
        if (!segment.text) {
          return null;
        }
        return <UserMessageText key={segment.id} text={segment.text} />;
      })}
    </span>
  );
}
