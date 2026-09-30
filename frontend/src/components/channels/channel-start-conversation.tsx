"use client";

import { SquarePenIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChatSendMessage } from "@/lib/chat/chat-helpers";
import { CHANNEL_THREAD_EMPTY_ROOT_TEXT } from "@/lib/chat/message-preview-text";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import {
  normalizeThreadTitle,
  THREAD_TITLE_MAX_LENGTH,
} from "@/shared/chat/thread-tags";
import { cn, generateUUID } from "@/shared/utils";

export function ChannelStartConversationFab({
  channelTitle,
  className,
  onStarted,
  sendMessage,
}: {
  channelTitle?: string;
  className?: string;
  onStarted: (rootMessageId: string) => void;
  sendMessage: ChatSendMessage;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
    }
  };

  const handleStart = async () => {
    const normalizedTitle = normalizeThreadTitle(title);
    if (!normalizedTitle) {
      return;
    }

    const messageId = generateUUID();
    setSubmitting(true);
    try {
      await sendMessage({
        id: messageId,
        metadata: {
          agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
          createdAt: new Date().toISOString(),
          threadTitle: normalizedTitle,
        },
        parts: [{ type: "text", text: CHANNEL_THREAD_EMPTY_ROOT_TEXT }],
        role: "user",
        threadRootMessageId: null,
      });
      onStarted(messageId);
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const channelLabel = channelTitle ? `#${channelTitle}` : "this channel";

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end px-4 pb-4",
          className
        )}
      >
        <Button
          className="pointer-events-auto shadow-md"
          onClick={() => setOpen(true)}
          size="lg"
          type="button"
        >
          <SquarePenIcon className="size-4 shrink-0" strokeWidth={2.25} />
          New chat
        </Button>
      </div>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-lg [&_button]:cursor-pointer"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="shrink-0 gap-0 px-6 pt-5 pb-0">
            <div className="flex items-start gap-3">
              <SquarePenIcon
                aria-hidden
                className="mt-0.5 size-8 shrink-0 stroke-[2] text-foreground"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0">
                <DialogTitle className="font-medium text-base leading-normal">
                  Start conversation
                </DialogTitle>
                <DialogDescription className="text-[12px] text-muted-foreground">
                  Name the thread, then write the first message on the right.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pt-3 pb-4">
            <Input
              aria-label="Thread title"
              autoFocus
              className="focus-visible:border-input focus-visible:ring-0"
              id="channel-conversation-title"
              maxLength={THREAD_TITLE_MAX_LENGTH}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleStart();
                }
              }}
              placeholder={`Topic in ${channelLabel}`}
              value={title}
            />
          </div>

          <DialogFooter className="shrink-0 gap-2 px-6 pt-0 pb-5 sm:justify-end">
            <Button
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={submitting || !normalizeThreadTitle(title)}
              onClick={() => {
                void handleStart();
              }}
              type="button"
            >
              Start conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
