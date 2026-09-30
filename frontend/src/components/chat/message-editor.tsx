"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import type { ChatSendMessage } from "@/lib/chat/chat-helpers";
import { editUserMessage } from "@/lib/chat/edit-user-message-client";
import { USER_OWN_MESSAGE_BUBBLE_CLASS } from "@/shared/chat/mention-styles";
import type { ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";

export async function submitEditedMessage({
  message,
  text,
  sendMessage,
}: {
  message: ChatMessage;
  text: string;
  sendMessage: ChatSendMessage;
}) {
  const editedAt = new Date().toISOString();
  const updatedMetadata = {
    ...message.metadata,
    editedAt,
  };

  await editUserMessage({
    id: message.id,
    metadata: updatedMetadata,
    parts: [{ text, type: "text" }],
  });

  await sendMessage({
    id: message.id,
    metadata: updatedMetadata,
    parts: [{ text, type: "text" }],
    replaceFromMessageId: message.id,
    role: "user",
  });
}

type UserMessageEditorProps = {
  className?: string;
  initialText: string;
  onCancel: () => void;
  onSend: (text: string) => void;
  /** Channel/thread row — bordered field in the message column (not DM bubble). */
  variant?: "bubble" | "flat";
};

export function UserMessageEditor({
  className,
  initialText,
  onCancel,
  onSend,
  variant = "bubble",
}: UserMessageEditorProps) {
  const [draft, setDraft] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    resizeTextarea();
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [resizeTextarea]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    resizeTextarea();
  };

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
  };

  return (
    <div
      className={cn(
        variant === "flat"
          ? "w-full min-w-0 rounded-md border border-border/60 bg-background px-3 py-2 shadow-sm"
          : cn(USER_OWN_MESSAGE_BUBBLE_CLASS, "w-full"),
        className
      )}
      data-testid="user-message-editor"
    >
      <textarea
        aria-label="Edit message"
        className="w-full resize-none border-0 bg-transparent text-base text-foreground leading-normal outline-none"
        onChange={handleChange}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }

          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleSend();
          }
        }}
        ref={textareaRef}
        rows={1}
        value={draft}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          className="h-8 rounded-lg border-border/60 bg-background px-4 text-foreground shadow-sm hover:bg-muted"
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="h-8 rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90"
          disabled={!draft.trim()}
          onClick={handleSend}
          type="button"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
