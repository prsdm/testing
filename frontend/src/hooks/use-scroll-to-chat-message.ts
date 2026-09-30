"use client";

import { useEffect, useRef } from "react";

export function chatMessageDomId(messageId: string) {
  return `chat-message-${messageId}`;
}

export const CHAT_MESSAGES_SCROLL_CONTAINER_ATTR = "data-chat-messages-scroll";
/** Left channel timeline while a room thread split is open. */
export const THREAD_CHANNEL_PANE_SCROLL_ATTR =
  "data-thread-channel-pane-scroll";

export type ChatMessageScrollTarget = {
  messageId: string;
  nonce: number;
  /** Search hits use yellow flash; thread navigation should not. */
  highlight?: boolean;
  behavior?: ScrollBehavior;
  /** Thread roots should scroll even when partially on screen (split-pane remount). */
  force?: boolean;
};

function findMessagesScrollContainer(element: HTMLElement): HTMLElement | null {
  const marked = element.closest(
    `[${CHAT_MESSAGES_SCROLL_CONTAINER_ATTR}]`
  ) as HTMLElement | null;
  if (marked) {
    return marked;
  }
  return element.closest(".overflow-y-auto") as HTMLElement | null;
}

function isMessageVisibleInContainer(
  element: HTMLElement,
  container: HTMLElement
): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return (
    elementRect.top >= containerRect.top - 8 &&
    elementRect.bottom <= containerRect.bottom + 8
  );
}

export function scrollChatMessageIntoView(args: {
  messageId: string;
  behavior?: ScrollBehavior;
  force?: boolean;
}): boolean {
  const element = document.getElementById(chatMessageDomId(args.messageId));
  if (!element) {
    return false;
  }

  const behavior = args.behavior ?? "smooth";
  const container = findMessagesScrollContainer(element);
  if (
    !args.force &&
    container &&
    isMessageVisibleInContainer(element, container)
  ) {
    return true;
  }

  if (container) {
    const elementTop =
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    const targetTop =
      elementTop - container.clientHeight / 2 + element.clientHeight / 2;
    container.scrollTo({
      behavior,
      top: Math.max(0, targetTop),
    });
    return true;
  }

  element.scrollIntoView({
    behavior,
    block: "center",
  });
  return true;
}

export function useScrollToChatMessage(args: {
  scrollTarget: ChatMessageScrollTarget | null;
  onScrolled?: (messageId: string, options: { highlight: boolean }) => void;
  onClearScrollTarget: () => void;
}) {
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const target = args.scrollTarget;
    const messageId = target?.messageId;
    if (!messageId) {
      return;
    }

    const highlight = target.highlight !== false;
    const scrolled = scrollChatMessageIntoView({
      behavior: target.behavior,
      force: target.force,
      messageId,
    });
    if (scrolled) {
      args.onScrolled?.(messageId, { highlight });
      args.onClearScrollTarget();
    }

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
  }, [args.onClearScrollTarget, args.onScrolled, args.scrollTarget]);

  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    },
    []
  );
}
