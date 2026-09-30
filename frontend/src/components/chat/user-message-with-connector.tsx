"use client";

import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import { removeConnectorMentionFromInput } from "@/shared/connectors/composer-connector-focus";
import { ConnectorFocusInlineBadge } from "./connector-focus-inline-badge";
import { UserMessageText } from "./user-message-text";

export function UserMessageWithConnector({
  focus,
  text,
  className,
}: {
  focus: ComposerConnectorFocus;
  text: string;
  className?: string;
}) {
  const visibleText = removeConnectorMentionFromInput(focus, text).trim();

  if (!visibleText) {
    return (
      <span className={className}>
        <ConnectorFocusInlineBadge focus={focus} variant="message" />
      </span>
    );
  }

  return (
    <span className={className}>
      <ConnectorFocusInlineBadge focus={focus} variant="message" />
      <span> </span>
      <UserMessageText text={visibleText} />
    </span>
  );
}
