import { useEffect, useState } from "react";
import type { ChatRunStatus } from "@/lib/chat/chat-helpers";
import { useScrollToBottom } from "./use-scroll-to-bottom";

export function useMessages({
  followBottom = true,
  status,
}: {
  status: ChatRunStatus;
  followBottom?: boolean;
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
    restoreScrollTop,
  } = useScrollToBottom({ followBottom });

  const [hasSentMessage, setHasSentMessage] = useState(false);

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      setHasSentMessage(true);
    }
  }, [status]);

  return {
    containerRef,
    endRef,
    hasSentMessage,
    isAtBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
    restoreScrollTop,
    scrollToBottom,
  };
}
