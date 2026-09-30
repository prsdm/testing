"use client";

import {
  CopyIcon,
  MessageSquareText,
  PencilIcon,
  SmilePlusIcon,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MessageReaction } from "@/contracts/message-reactions";
import {
  optimisticToggleReaction,
  reactionsApiUrl,
  toggleMessageReaction,
} from "@/lib/chat/toggle-message-reaction";
import {
  MESSAGE_REACTION_CHIP_ACTIVE_CLASS,
  MESSAGE_REACTION_CHIP_INACTIVE_CLASS,
} from "@/shared/chat/mention-styles";
import { groupMessageReactions } from "@/shared/chat/message-reaction-groups";
import { PICKER_MESSAGE_REACTIONS } from "@/shared/chat/quick-reactions";
import { cn } from "@/shared/utils";
import { MessageAction as Action } from "../ai-elements/message";

/** Topic card footer: transparent until hover (matches add-reaction). */
export const MESSAGE_TOPIC_FOOTER_ICON_BUTTON_CLASS =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-muted/55";

export const MESSAGE_FLOATING_ACTIONS_BAR_CLASS =
  "flex items-center gap-0.5 rounded-lg border border-border/50 bg-background/95 px-0.5 py-0.5 shadow-sm backdrop-blur-sm";

function ReactionEmojiButton({
  className,
  emoji,
  onClick,
  size = "md",
}: {
  className?: string;
  emoji: string;
  onClick: () => void;
  size?: "md" | "sm";
}) {
  return (
    <button
      className={cn(
        "cursor-pointer rounded-md transition-colors hover:bg-muted/80",
        size === "sm" ? "px-1.5 py-0.5 text-base" : "size-8 text-lg",
        className
      )}
      onClick={onClick}
      type="button"
    >
      {emoji}
    </button>
  );
}

function useMessageReactionToggle(args: {
  chatId: string;
  currentUserId: string | null | undefined;
  messageId: string;
  reactions: MessageReaction[];
  onPicked?: () => void;
}) {
  const { mutate } = useSWRConfig();
  const { chatId, currentUserId, messageId, reactions, onPicked } = args;

  return useCallback(
    async (emoji: string) => {
      if (!currentUserId) {
        return;
      }
      const key = reactionsApiUrl(chatId);
      await mutate(
        key,
        optimisticToggleReaction({
          chatId,
          currentUserId,
          emoji,
          messageId,
          reactions,
        }),
        { revalidate: false }
      );
      try {
        await toggleMessageReaction({
          chatId,
          currentUserId,
          emoji,
          messageId,
        });
      } catch {
        await mutate(key);
        toast.error("Could not save reaction. Try again.");
        return;
      }
      void mutate(key);
      onPicked?.();
    },
    [chatId, currentUserId, messageId, mutate, onPicked, reactions]
  );
}

export function MessageAddReactionPicker({
  chatId,
  className,
  currentUserId,
  messageId,
  popoverAlign = "end",
  popoverAlignOffset = 0,
  popoverSide = "bottom",
  reactions,
  triggerClassName,
}: {
  chatId: string;
  className?: string;
  currentUserId: string | null | undefined;
  messageId: string;
  popoverAlign?: "center" | "end" | "start";
  popoverAlignOffset?: number;
  popoverSide?: "bottom" | "left" | "right" | "top";
  reactions: MessageReaction[];
  triggerClassName?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const toggle = useMessageReactionToggle({
    chatId,
    currentUserId,
    messageId,
    onPicked: () => setPickerOpen(false),
    reactions,
  });

  if (!currentUserId) {
    return null;
  }

  return (
    <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Add reaction"
          className={cn(
            MESSAGE_TOPIC_FOOTER_ICON_BUTTON_CLASS,
            pickerOpen && "bg-muted text-foreground dark:bg-muted/55",
            triggerClassName,
            className
          )}
          data-state={pickerOpen ? "open" : "closed"}
          type="button"
        >
          <SmilePlusIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={popoverAlign}
        alignOffset={popoverAlignOffset}
        className="w-auto p-1.5"
        side={popoverSide}
        sideOffset={6}
      >
        <div className="grid grid-cols-4 gap-0.5">
          {PICKER_MESSAGE_REACTIONS.map((emoji) => (
            <ReactionEmojiButton
              className="size-9 text-xl"
              emoji={emoji}
              key={emoji}
              onClick={() => toggle(emoji)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MessageReactionChips({
  chatId,
  className,
  currentUserId,
  messageId,
  reactions,
}: {
  chatId: string;
  className?: string;
  currentUserId: string | null | undefined;
  messageId: string;
  reactions: MessageReaction[];
}) {
  const toggle = useMessageReactionToggle({
    chatId,
    currentUserId,
    messageId,
    reactions,
  });

  const groups = useMemo(
    () =>
      groupMessageReactions({
        currentUserId,
        messageId,
        reactions,
      }),
    [currentUserId, messageId, reactions]
  );

  if (groups.length === 0 || !currentUserId) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {groups.map((group) => (
        <button
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-sm transition-colors",
            group.reactedByCurrentUser
              ? MESSAGE_REACTION_CHIP_ACTIVE_CLASS
              : MESSAGE_REACTION_CHIP_INACTIVE_CLASS,
            "text-foreground"
          )}
          key={group.emoji}
          onClick={() => toggle(group.emoji)}
          type="button"
        >
          <span aria-hidden>{group.emoji}</span>
          <span className="font-medium text-xs tabular-nums">
            {group.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export const MessageReactionActions = memo(function MessageReactionActions({
  chatId,
  currentUserId,
  floatingToolbar = false,
  includeReactionPicker = true,
  messageId,
  onCopy,
  onEdit,
  onOpenThread,
  reactions,
  reactionPopoverAlign = "start",
  reactionPopoverSide = "bottom",
}: {
  chatId: string;
  currentUserId: string | null | undefined;
  floatingToolbar?: boolean;
  includeReactionPicker?: boolean;
  messageId: string;
  onCopy?: () => void;
  onEdit?: () => void;
  onOpenThread?: () => void;
  reactionPopoverAlign?: "center" | "end" | "start";
  reactionPopoverSide?: "bottom" | "left" | "right" | "top";
  reactions: MessageReaction[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const toggle = useMessageReactionToggle({
    chatId,
    currentUserId,
    messageId,
    onPicked: () => setPickerOpen(false),
    reactions,
  });

  const showReactions = Boolean(currentUserId) && includeReactionPicker;
  const showBar = showReactions || onCopy || onEdit || onOpenThread;

  if (!showBar) {
    return null;
  }

  const bar = (
    <>
      {showReactions ? (
        <Popover onOpenChange={setPickerOpen} open={pickerOpen}>
          <PopoverTrigger asChild>
            <Action
              className="size-7 text-muted-foreground/70 hover:text-foreground"
              label="Add reaction"
            >
              <SmilePlusIcon className="size-4" />
            </Action>
          </PopoverTrigger>
          <PopoverContent
            align={reactionPopoverAlign}
            className="w-auto p-1.5"
            side={reactionPopoverSide}
          >
            <div className="grid grid-cols-4 gap-0.5">
              {PICKER_MESSAGE_REACTIONS.map((emoji) => (
                <ReactionEmojiButton
                  className="size-9 text-xl"
                  emoji={emoji}
                  key={emoji}
                  onClick={() => toggle(emoji)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      {onOpenThread ? (
        <Action
          className="size-7 text-muted-foreground/50 hover:text-foreground"
          label="Reply in thread"
          onClick={onOpenThread}
        >
          <MessageSquareText className="size-4" />
        </Action>
      ) : null}
      {onCopy ? (
        <Action
          className="size-7 text-muted-foreground/50 hover:text-foreground"
          label="Copy"
          onClick={onCopy}
        >
          <CopyIcon className="size-4" />
        </Action>
      ) : null}
      {onEdit ? (
        <Action
          className="size-7 text-muted-foreground/50 hover:text-foreground"
          data-testid="message-edit-button"
          label="Edit"
          onClick={onEdit}
        >
          <PencilIcon className="size-4" />
        </Action>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-0",
        floatingToolbar && MESSAGE_FLOATING_ACTIONS_BAR_CLASS
      )}
    >
      {bar}
    </div>
  );
});
