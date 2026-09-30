"use client";

import equal from "fast-deep-equal";
import { ArrowDownIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { workspaceContentWidthClassName } from "@/components/workspace/workspace-page-layout";
import type { MessageReaction } from "@/contracts/message-reactions";
import { useMessages } from "@/hooks/use-messages";
import { useScrollToBottomOnKeyChange } from "@/hooks/use-scroll-to-bottom";
import type { ChatRunStatus, ChatSetMessages } from "@/lib/chat/chat-helpers";
import {
  type ChatTimelineScrollSnapshot,
  chatScrollSnapshotFromContainer,
  recallChatTimelineScroll,
  rememberChatTimelineScroll,
} from "@/lib/chat/chat-timeline-scroll-memory";
import {
  getMessageSectionAnchor,
  shouldShowMessageSectionTime,
} from "@/lib/chat/message-section-time";
import { shouldContinueRoomMessageGroup } from "@/lib/chat/room-message-grouping";
import {
  isAssistantMessageStreamingForViewer,
  shouldShowPendingAssistantThinking,
} from "@/lib/chat/room-message-visibility";
import { buildThreadSummaries } from "@/lib/chat/thread-summary";
import { assistantTurnAwaitingPostDenialContinuation } from "@/shared/chat/denied-tool-suffix";
import { isChatAreaPath } from "@/shared/chat/routes";
import type { ThreadTag } from "@/shared/chat/thread-tags";
import type { ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";
import { useDataStream } from "./data-stream-provider";
import { type BottomSource, PreviewMessage, ThinkingMessage } from "./message";
import { MessageSectionTime } from "./message-section-time";

type MessagesProps = {
  chatId: string;
  status: ChatRunStatus;
  messageReactions: MessageReaction[] | undefined;
  reactionsUserId: string | undefined;
  messages: ChatMessage[];
  /** Full chat list (includes thread replies) for thread summary faces/times. */
  allChatMessages?: ChatMessage[];
  setMessages: ChatSetMessages;
  regenerate: () => void;
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isMultiplayerRoom?: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (message: ChatMessage, text: string) => void;
  onOpenSourcesSidebar?: (payload: {
    messageId: string;
    sources: BottomSource[];
  }) => void;
  onOpenThread?: (messageId: string) => void;
  threadReplyCounts?: Record<string, number>;
  showThreadActions?: boolean;
  highlightMessageId?: string | null;
  /** Default true for main timeline; false for thread-split channel pane. */
  pinToLatestOnMount?: boolean;
  /** Restore scroll after closing a thread split (main timeline remount). */
  initialScrollTop?: number | null;
  onInitialScrollApplied?: () => void;
  /** Marks scroll container when shown in the thread-split channel pane. */
  threadChannelPaneScroll?: boolean;
  /** When set, scroll position is remembered for this session (chat switch, workspace nav). */
  scrollMemoryKey?: string;
  /** Which thread owns the active composer run, if any (`null` = main timeline). */
  activeRunComposerThreadRootMessageId?: string | null;
  /** Thread pane being viewed (`null` = main timeline). */
  viewThreadRootMessageId?: string | null;
  /** Highlight topic root in main feed while thread split is open. */
  openThreadRootMessageId?: string | null;
  /** Teams-style bordered topic cards on the channel main timeline. */
  isChannelTopicLayout?: boolean;
  /** Slack-style thread pane inside channel split (root, divider, replies). */
  isChannelThreadLayout?: boolean;
  /** Channel split list: newest root posts first (inbox / mail order). */
  channelInboxListReverse?: boolean;
  channelThreadTagCatalog?: ThreadTag[];
};

function PureMessages({
  chatId,
  status,
  messageReactions,
  reactionsUserId,
  messages,
  allChatMessages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isMultiplayerRoom = false,
  isLoading = false,
  selectedModelId: _selectedModelId,
  onEditMessage,
  editingMessage,
  onCancelEdit,
  onSubmitEdit,
  onOpenThread,
  onOpenSourcesSidebar,
  threadReplyCounts = {},
  showThreadActions = false,
  highlightMessageId = null,
  pinToLatestOnMount = true,
  initialScrollTop = null,
  onInitialScrollApplied,
  threadChannelPaneScroll = false,
  scrollMemoryKey,
  activeRunComposerThreadRootMessageId,
  viewThreadRootMessageId = null,
  openThreadRootMessageId = null,
  isChannelTopicLayout = false,
  isChannelThreadLayout = false,
  channelInboxListReverse = false,
  channelThreadTagCatalog = [],
}: MessagesProps) {
  const isChannelMainTimeline = isChannelTopicLayout && !isChannelThreadLayout;
  const isChannelMainCards = isChannelMainTimeline;
  const sessionUser = useSessionUser();
  const pathname = usePathname();
  const wasOnChatAreaRef = useRef(isChatAreaPath(pathname));
  const scrollMemoryKeyRef = useRef(scrollMemoryKey);
  scrollMemoryKeyRef.current = scrollMemoryKey;
  const programmaticScrollRef = useRef(false);
  const userAdjustedScrollRef = useRef(false);
  const appliedExplicitInitialRef = useRef(false);

  const memorySnapshot =
    scrollMemoryKey == null
      ? undefined
      : recallChatTimelineScroll(scrollMemoryKey);
  const followBottom =
    initialScrollTop == null
      ? memorySnapshot
        ? memorySnapshot.atBottom
        : pinToLatestOnMount
      : false;

  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
    reset,
    restoreScrollTop,
  } = useMessages({
    followBottom,
    status,
  });

  useDataStream();

  const scrollPositionKey = scrollMemoryKey ?? chatId;

  const applyScrollSnapshot = useCallback(
    (snapshot: ChatTimelineScrollSnapshot) => {
      if (userAdjustedScrollRef.current) {
        return;
      }
      programmaticScrollRef.current = true;
      if (snapshot.atBottom) {
        scrollToBottom("instant");
      } else {
        restoreScrollTop(snapshot.scrollTop);
      }
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    },
    [restoreScrollTop, scrollToBottom]
  );

  const resolveRestoreSnapshot =
    useCallback((): ChatTimelineScrollSnapshot | null => {
      if (initialScrollTop != null) {
        return { atBottom: false, scrollTop: initialScrollTop };
      }
      if (!scrollMemoryKey) {
        return null;
      }
      return recallChatTimelineScroll(scrollMemoryKey) ?? null;
    }, [initialScrollTop, scrollMemoryKey]);

  const runScheduledRestore = useCallback(() => {
    const snapshot = resolveRestoreSnapshot();
    if (snapshot) {
      applyScrollSnapshot(snapshot);
      if (initialScrollTop != null && !appliedExplicitInitialRef.current) {
        appliedExplicitInitialRef.current = true;
        onInitialScrollApplied?.();
      }
      return;
    }
    if (isLoading || userAdjustedScrollRef.current || !pinToLatestOnMount) {
      return;
    }
    programmaticScrollRef.current = true;
    scrollToBottom("instant");
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [
    applyScrollSnapshot,
    initialScrollTop,
    isLoading,
    onInitialScrollApplied,
    pinToLatestOnMount,
    resolveRestoreSnapshot,
    scrollToBottom,
  ]);

  useLayoutEffect(() => {
    void scrollPositionKey;
    userAdjustedScrollRef.current = false;
    appliedExplicitInitialRef.current = false;
  }, [scrollPositionKey]);

  useScrollToBottomOnKeyChange({
    applyScrollSnapshot,
    containerRef: messagesContainerRef,
    key: scrollPositionKey,
    recallScrollSnapshot: recallChatTimelineScroll,
    rememberScrollSnapshot: rememberChatTimelineScroll,
    reset,
    scrollToBottom,
  });

  useLayoutEffect(() => {
    const key = scrollMemoryKey;
    const container = messagesContainerRef.current;
    return () => {
      if (key && container) {
        rememberChatTimelineScroll(
          key,
          chatScrollSnapshotFromContainer(container)
        );
      }
    };
  }, [messagesContainerRef, scrollMemoryKey]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const key = scrollMemoryKey;
    if (!container || !key) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handleScroll = () => {
      if (!programmaticScrollRef.current) {
        userAdjustedScrollRef.current = true;
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        rememberChatTimelineScroll(
          key,
          chatScrollSnapshotFromContainer(container)
        );
      }, 120);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, [messagesContainerRef, scrollMemoryKey]);

  useLayoutEffect(() => {
    const onChat = isChatAreaPath(pathname);
    const wasOnChat = wasOnChatAreaRef.current;
    wasOnChatAreaRef.current = onChat;
    const key = scrollMemoryKeyRef.current;
    const container = messagesContainerRef.current;
    if (!key || !container) {
      return;
    }

    if (wasOnChat && !onChat) {
      rememberChatTimelineScroll(
        key,
        chatScrollSnapshotFromContainer(container)
      );
      return;
    }
    if (!wasOnChat && onChat) {
      userAdjustedScrollRef.current = false;
      runScheduledRestore();
    }
  }, [messagesContainerRef, pathname, runScheduledRestore]);

  useLayoutEffect(() => {
    void isLoading;
    void messages.length;
    void scrollPositionKey;
    runScheduledRestore();
    const timers = [50, 150, 400, 800, 1500, 2500].map((delay) =>
      window.setTimeout(runScheduledRestore, delay)
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [isLoading, messages.length, runScheduledRestore, scrollPositionKey]);

  useEffect(() => {
    const saveSnapshot = () => {
      const container = messagesContainerRef.current;
      const key = scrollMemoryKeyRef.current;
      if (!container || !key) {
        return;
      }
      rememberChatTimelineScroll(
        key,
        chatScrollSnapshotFromContainer(container)
      );
    };
    window.addEventListener("pagehide", saveSnapshot);
    return () => window.removeEventListener("pagehide", saveSnapshot);
  }, [messagesContainerRef]);

  const visibleMessages = useMemo(
    () => (channelInboxListReverse ? [...messages].reverse() : messages),
    [channelInboxListReverse, messages]
  );
  const threadSummaries = useMemo(
    () => buildThreadSummaries(allChatMessages ?? messages, threadReplyCounts),
    [allChatMessages, messages, threadReplyCounts]
  );

  return (
    <div className="chat-area-interactive relative min-h-0 flex-1 bg-background">
      <div
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          isChannelTopicLayout && "no-scrollbar",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        data-chat-messages-scroll=""
        {...(threadChannelPaneScroll
          ? { "data-thread-channel-pane-scroll": "" }
          : {})}
        ref={messagesContainerRef}
        style={isArtifactVisible ? { scrollbarWidth: "none" } : undefined}
      >
        <div
          className={cn(
            "flex min-h-full min-w-0 flex-col pb-4",
            isChannelThreadLayout
              ? cn(workspaceContentWidthClassName, "min-w-0 gap-4 pt-4 md:pt-5")
              : isChannelTopicLayout
                ? cn(
                    "w-full gap-0 pb-0",
                    threadChannelPaneScroll
                      ? "pb-16 pt-0"
                      : "mx-auto max-w-3xl pt-6 md:pt-10"
                  )
                : cn(
                    "mx-auto max-w-3xl px-2 pt-10 md:px-4 md:pt-14",
                    isMultiplayerRoom ? "gap-0" : "gap-4 md:gap-6"
                  )
          )}
        >
          {visibleMessages.map((message, index) => {
            const currentAt = getMessageSectionAnchor(message);
            const chronologyPreviousAt = channelInboxListReverse
              ? index < visibleMessages.length - 1
                ? getMessageSectionAnchor(visibleMessages[index + 1])
                : undefined
              : index > 0
                ? getMessageSectionAnchor(visibleMessages[index - 1])
                : undefined;
            const showSectionTime =
              !channelInboxListReverse &&
              shouldShowMessageSectionTime(currentAt, chronologyPreviousAt);
            const previousMessage =
              index > 0 ? visibleMessages[index - 1] : undefined;
            const roomGroupContinuation =
              Boolean(isMultiplayerRoom) &&
              !isChannelMainTimeline &&
              previousMessage != null &&
              shouldContinueRoomMessageGroup(
                previousMessage,
                message,
                sessionUser?.id,
                {
                  previousThreadReplyCount:
                    threadReplyCounts[previousMessage.id] ?? 0,
                }
              );

            const messageRowKey =
              isChannelTopicLayout && openThreadRootMessageId
                ? `${message.id}:${openThreadRootMessageId === message.id ? "thread-open" : "thread-idle"}`
                : message.id;

            return (
              <Fragment key={messageRowKey}>
                {showSectionTime && currentAt ? (
                  <MessageSectionTime createdAt={currentAt} />
                ) : null}
                <div
                  className={cn(
                    isChannelTopicLayout || isChannelThreadLayout
                      ? undefined
                      : isMultiplayerRoom &&
                          (roomGroupContinuation ? "mt-1" : "mt-4")
                  )}
                >
                  <PreviewMessage
                    channelMainFlat={false}
                    channelThreadPane={isChannelThreadLayout}
                    channelThreadTagCatalog={channelThreadTagCatalog}
                    channelTopicCard={isChannelMainCards}
                    channelTopicInbox={isChannelMainCards}
                    chatId={chatId}
                    editingMessage={editingMessage}
                    highlightMessageId={highlightMessageId}
                    isLoading={isAssistantMessageStreamingForViewer({
                      awaitingPostDenialContinuation:
                        assistantTurnAwaitingPostDenialContinuation(
                          message.parts ?? []
                        ),
                      chatId,
                      isLastVisible: channelInboxListReverse
                        ? index === 0
                        : visibleMessages.length - 1 === index,
                      isMultiplayerRoom: Boolean(isMultiplayerRoom),
                      message,
                      status,
                      workflowRunActive:
                        status === "submitted" || status === "streaming",
                    })}
                    isMultiplayerRoom={isMultiplayerRoom}
                    isReadonly={isReadonly}
                    message={message}
                    messageReactions={messageReactions ?? []}
                    onCancelEdit={onCancelEdit}
                    onEdit={onEditMessage}
                    onOpenSourcesSidebar={
                      onOpenSourcesSidebar
                        ? (sources) =>
                            onOpenSourcesSidebar({
                              messageId: message.id,
                              sources,
                            })
                        : undefined
                    }
                    onOpenThread={
                      (showThreadActions || isChannelTopicLayout) &&
                      onOpenThread
                        ? () => onOpenThread(message.id)
                        : undefined
                    }
                    onSubmitEdit={onSubmitEdit}
                    openThreadRootMessageId={openThreadRootMessageId}
                    reactionsUserId={reactionsUserId}
                    regenerate={regenerate}
                    requiresScrollPadding={
                      hasSentMessage &&
                      (channelInboxListReverse
                        ? index === 0
                        : index === visibleMessages.length - 1)
                    }
                    roomGroupContinuation={roomGroupContinuation}
                    setMessages={setMessages}
                    threadReplyCount={threadReplyCounts[message.id] ?? 0}
                    threadSummary={threadSummaries[message.id]}
                    viewThreadRootMessageId={viewThreadRootMessageId}
                  />
                </div>
              </Fragment>
            );
          })}

          {shouldShowPendingAssistantThinking({
            activeRunComposerThreadRootMessageId,
            messages: visibleMessages,
            status,
            viewThreadRootMessageId,
          }) ? (
            <ThinkingMessage key="thinking" />
          ) : null}

          <div className="min-h-6 min-w-6 shrink-0" ref={messagesEndRef} />
        </div>
      </div>

      {channelInboxListReverse ? null : (
        <button
          aria-label="Scroll to bottom"
          className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-(--shadow-float) backdrop-blur-lg transition-all duration-200 h-7 text-[10px] ${
            isAtBottom
              ? "pointer-events-none scale-90 opacity-0"
              : "pointer-events-auto scale-100 opacity-100"
          }`}
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(
  PureMessages,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.messages === nextProps.messages &&
    prevProps.allChatMessages === nextProps.allChatMessages &&
    prevProps.threadReplyCounts === nextProps.threadReplyCounts &&
    prevProps.status === nextProps.status &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isArtifactVisible === nextProps.isArtifactVisible &&
    prevProps.messageReactions === nextProps.messageReactions &&
    prevProps.reactionsUserId === nextProps.reactionsUserId &&
    prevProps.editingMessage?.id === nextProps.editingMessage?.id &&
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.highlightMessageId === nextProps.highlightMessageId &&
    prevProps.isChannelTopicLayout === nextProps.isChannelTopicLayout &&
    prevProps.isChannelThreadLayout === nextProps.isChannelThreadLayout &&
    prevProps.channelInboxListReverse === nextProps.channelInboxListReverse &&
    prevProps.viewThreadRootMessageId === nextProps.viewThreadRootMessageId &&
    prevProps.openThreadRootMessageId === nextProps.openThreadRootMessageId &&
    equal(prevProps.channelThreadTagCatalog, nextProps.channelThreadTagCatalog)
);
