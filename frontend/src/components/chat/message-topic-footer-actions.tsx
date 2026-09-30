"use client";

import { CopyIcon, PencilIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { MESSAGE_TOPIC_FOOTER_ICON_BUTTON_CLASS } from "@/components/chat/message-reactions";
import {
  composerInlinePlainText,
  composerInlineWireText,
  inlineBodyHasConnectorSegments,
  resolveMessageInlineBody,
} from "@/lib/chat/composer-inline-body";
import { writeComposerInlineClipboard } from "@/lib/chat/composer-inline-clipboard";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import type { ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";

export function MessageTopicCardFooterActions({
  className,
  isLoading,
  message,
  onEdit,
}: {
  className?: string;
  isLoading: boolean;
  message: ChatMessage;
  onEdit?: () => void;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();

  const wireFromParts =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim() ?? "";

  const inlineBody = useMemo(
    () =>
      resolveMessageInlineBody({
        focuses: (message.metadata?.composerConnectorFocuses?.length
          ? message.metadata.composerConnectorFocuses
          : message.metadata?.composerConnectorFocus
            ? [message.metadata.composerConnectorFocus]
            : undefined) as ComposerConnectorFocus[] | undefined,
        storedInlineBody: message.metadata?.composerInlineBody,
        wireText: wireFromParts,
      }),
    [message.metadata, wireFromParts]
  );

  if (isLoading || message.metadata?.pendingToolApproval) {
    return null;
  }

  const textFromParts =
    message.metadata?.composerText?.trim() ||
    wireFromParts ||
    (inlineBody ? composerInlinePlainText(inlineBody).trim() : "");

  const handleCopy = async () => {
    if (!textFromParts && !wireFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    if (inlineBody && inlineBodyHasConnectorSegments(inlineBody)) {
      try {
        await writeComposerInlineClipboard({ inlineBody });
        toast.success("Copied to clipboard!");
        return;
      } catch {
        // Fall back to plain wire text below.
      }
    }

    const fallback =
      wireFromParts ||
      (inlineBody ? composerInlineWireText(inlineBody) : textFromParts);
    await copyToClipboard(fallback);
    toast.success("Copied to clipboard!");
  };

  const showEdit = message.role === "user" && onEdit;
  const showCopy = Boolean(textFromParts);

  if (!showEdit && !showCopy) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {showEdit ? (
        <button
          aria-label="Edit"
          className={MESSAGE_TOPIC_FOOTER_ICON_BUTTON_CLASS}
          data-testid="message-edit-button"
          onClick={onEdit}
          type="button"
        >
          <PencilIcon className="size-4" />
        </button>
      ) : null}
      {showCopy ? (
        <button
          aria-label="Copy"
          className={MESSAGE_TOPIC_FOOTER_ICON_BUTTON_CLASS}
          onClick={() => {
            void handleCopy();
          }}
          type="button"
        >
          <CopyIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
