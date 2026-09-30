import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { chatScrollSnapshotFromContainer } from "@/lib/chat/chat-timeline-scroll-memory";

const BOTTOM_THRESHOLD_PX = 120;

function distanceFromBottom(container: HTMLElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function isScrollContainerVisible(container: HTMLElement): boolean {
  return container.clientHeight > 1 && container.getClientRects().length > 0;
}

function isNearBottom(container: HTMLElement): boolean {
  if (!isScrollContainerVisible(container)) {
    return false;
  }
  if (container.scrollHeight <= container.clientHeight + 1) {
    return true;
  }
  return distanceFromBottom(container) <= BOTTOM_THRESHOLD_PX;
}

function pinScrollToBottom(container: HTMLElement) {
  const scroll = () => {
    container.scrollTo({
      behavior: "instant",
      top: container.scrollHeight,
    });
  };
  scroll();
  requestAnimationFrame(() => {
    scroll();
    requestAnimationFrame(scroll);
  });
}

export function useScrollToBottom(options?: { followBottom?: boolean }) {
  const followBottom = options?.followBottom !== false;
  const followBottomRef = useRef(followBottom);
  followBottomRef.current = followBottom;

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(followBottom);
  const isAtBottomRef = useRef(followBottom);
  const isUserScrollingRef = useRef(false);
  /** True when the user was reading the latest messages before leaving the tab/window. */
  const stickToBottomOnReturnRef = useRef(followBottom);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const updateIsAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container || !isScrollContainerVisible(container)) {
      return;
    }

    const atBottom = isNearBottom(container);
    setIsAtBottom(atBottom);
    isAtBottomRef.current = atBottom;
    stickToBottomOnReturnRef.current = atBottom;
  }, []);

  const restoreScrollTop = useCallback(
    (scrollTop: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      container.scrollTop = scrollTop;
      isUserScrollingRef.current = false;
      updateIsAtBottom();
    },
    [updateIsAtBottom]
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      behavior,
      top: container.scrollHeight,
    });
    if (behavior === "instant") {
      isAtBottomRef.current = true;
      stickToBottomOnReturnRef.current = true;
      setIsAtBottom(true);
    }
  }, []);

  const restoreBottomIfNeeded = useCallback(() => {
    const container = containerRef.current;
    if (
      !container ||
      !isScrollContainerVisible(container) ||
      !followBottomRef.current
    ) {
      updateIsAtBottom();
      return;
    }
    if (!stickToBottomOnReturnRef.current) {
      updateIsAtBottom();
      return;
    }

    isAtBottomRef.current = true;
    setIsAtBottom(true);
    isUserScrollingRef.current = false;
    pinScrollToBottom(container);
    updateIsAtBottom();

    window.setTimeout(() => {
      if (stickToBottomOnReturnRef.current && containerRef.current) {
        pinScrollToBottom(containerRef.current);
        updateIsAtBottom();
      }
    }, 150);
  }, [updateIsAtBottom]);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;
    if (!container || !end) {
      return;
    }

    const observer = new IntersectionObserver(
      () => {
        if (document.visibilityState === "hidden") {
          return;
        }
        updateIsAtBottom();
      },
      {
        root: container,
        rootMargin: `0px 0px ${BOTTOM_THRESHOLD_PX}px 0px`,
        threshold: 0,
      }
    );

    observer.observe(end);
    updateIsAtBottom();

    return () => observer.disconnect();
  }, [updateIsAtBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);
      updateIsAtBottom();

      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
        updateIsAtBottom();
      }, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [updateIsAtBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollFrame: number | null = null;

    const scrollIfNeeded = () => {
      if (scrollFrame !== null) {
        return;
      }
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        if (
          isScrollContainerVisible(container) &&
          followBottomRef.current &&
          isAtBottomRef.current &&
          !isUserScrollingRef.current
        ) {
          pinScrollToBottom(container);
        }
        updateIsAtBottom();
      });
    };

    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(scrollIfNeeded);
    resizeObserver.observe(container);

    for (const child of container.children) {
      resizeObserver.observe(child);
    }

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      if (scrollFrame !== null) {
        cancelAnimationFrame(scrollFrame);
      }
    };
  }, [updateIsAtBottom]);

  useEffect(() => {
    const snapshotStickiness = () => {
      const container = containerRef.current;
      if (!container || !isScrollContainerVisible(container)) {
        return;
      }
      stickToBottomOnReturnRef.current = isNearBottom(container);
      isAtBottomRef.current = stickToBottomOnReturnRef.current;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        snapshotStickiness();
        return;
      }
      restoreBottomIfNeeded();
    };

    const handleWindowFocus = () => {
      restoreBottomIfNeeded();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [restoreBottomIfNeeded]);

  function onViewportEnter() {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    stickToBottomOnReturnRef.current = true;
  }

  function onViewportLeave() {
    setIsAtBottom(false);
    isAtBottomRef.current = false;
    stickToBottomOnReturnRef.current = false;
  }

  const reset = useCallback(() => {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    stickToBottomOnReturnRef.current = true;
    isUserScrollingRef.current = false;
    const container = containerRef.current;
    if (container) {
      pinScrollToBottom(container);
    }
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
    restoreScrollTop,
    scrollToBottom,
  };
}

/** Call after the message list changes size (e.g. switching chats). */
export function useScrollToBottomOnKeyChange(args: {
  applyScrollSnapshot: (snapshot: {
    atBottom: boolean;
    scrollTop: number;
  }) => void;
  containerRef: RefObject<HTMLElement | null>;
  key: string;
  recallScrollSnapshot?: (key: string) =>
    | {
        atBottom: boolean;
        scrollTop: number;
      }
    | undefined;
  rememberScrollSnapshot?: (
    key: string,
    snapshot: { atBottom: boolean; scrollTop: number }
  ) => void;
  reset: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}) {
  const prevKeyRef = useRef(args.key);
  useLayoutEffect(() => {
    if (prevKeyRef.current === args.key) {
      return;
    }
    const leavingKey = prevKeyRef.current;
    const container = args.containerRef.current;
    if (container && args.rememberScrollSnapshot) {
      args.rememberScrollSnapshot(
        leavingKey,
        chatScrollSnapshotFromContainer(container)
      );
    }
    prevKeyRef.current = args.key;

    const recalled = args.recallScrollSnapshot?.(args.key);
    if (recalled) {
      args.applyScrollSnapshot(recalled);
      return;
    }

    args.reset();
    args.scrollToBottom("instant");
  }, [
    args.applyScrollSnapshot,
    args.containerRef,
    args.key,
    args.recallScrollSnapshot,
    args.rememberScrollSnapshot,
    args.reset,
    args.scrollToBottom,
  ]);
}
