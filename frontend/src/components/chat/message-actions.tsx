import equal from "fast-deep-equal";
import { memo, useMemo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { MessageReactionActions } from "@/components/chat/message-reactions";
import type { MessageReaction } from "@/contracts/message-reactions";
import {
  composerInlinePlainText,
  composerInlineWireText,
  inlineBodyHasConnectorSegments,
  resolveMessageInlineBody,
} from "@/lib/chat/composer-inline-body";
import { writeComposerInlineClipboard } from "@/lib/chat/composer-inline-clipboard";
import { reactionsForMessage } from "@/shared/chat/message-reaction-groups";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import type { ChatMessage } from "@/shared/types";
import { MessageActions as Actions } from "../ai-elements/message";

export function PureMessageActions({
  chatId,
  currentUserId,
  message,
  reactions,
  isLoading,
  onEdit,
  onOpenThread,
  alwaysVisible = false,
  floatingToolbar = false,
  includeReactionPicker = true,
}: {
  chatId: string;
  currentUserId: string | null | undefined;
  message: ChatMessage;
  reactions: MessageReaction[];
  isLoading: boolean;
  onEdit?: () => void;
  onOpenThread?: () => void;
  alwaysVisible?: boolean;
  floatingToolbar?: boolean;
  includeReactionPicker?: boolean;
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

  const hoverClass = alwaysVisible
    ? "-mr-0.5 justify-start opacity-100"
    : message.role === "user"
      ? "-mr-0.5 justify-end opacity-0 transition-opacity duration-150 group-hover/message:opacity-100"
      : "opacity-0 transition-opacity duration-150 group-hover/message:opacity-100";

  const reactionBar = (
    <MessageReactionActions
      chatId={chatId}
      currentUserId={currentUserId}
      floatingToolbar={floatingToolbar}
      includeReactionPicker={includeReactionPicker}
      messageId={message.id}
      onCopy={textFromParts ? handleCopy : undefined}
      onEdit={message.role === "user" && onEdit ? onEdit : undefined}
      onOpenThread={onOpenThread}
      reactionPopoverAlign={floatingToolbar ? "end" : "start"}
      reactionPopoverSide={floatingToolbar ? "top" : "bottom"}
      reactions={reactions}
    />
  );

  if (floatingToolbar) {
    return reactionBar;
  }

  return <Actions className={hoverClass}>{reactionBar}</Actions>;
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (
      !equal(
        reactionsForMessage(prevProps.reactions, prevProps.message.id),
        reactionsForMessage(nextProps.reactions, nextProps.message.id)
      )
    ) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.currentUserId !== nextProps.currentUserId) {
      return false;
    }
    if (prevProps.onOpenThread !== nextProps.onOpenThread) {
      return false;
    }
    if (prevProps.onEdit !== nextProps.onEdit) {
      return false;
    }
    if (prevProps.alwaysVisible !== nextProps.alwaysVisible) {
      return false;
    }

    return true;
  }
);
