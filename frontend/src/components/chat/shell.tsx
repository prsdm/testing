"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChannelFilesLinksPanel } from "@/components/channels/channel-files-links-panel";
import { ChannelLibraryPanel } from "@/components/channels/channel-library-panel";
import { ChannelStartConversationFab } from "@/components/channels/channel-start-conversation";
import {
  ChannelThreadPaneHeader,
  type ChannelThreadSplitHeaderMeta,
  ChannelWorkspaceHeader,
  type ChannelWorkspaceView,
} from "@/components/channels/channel-workspace-header";
import {
  DmThreadSplitHeader,
  DmWorkspaceHeader,
} from "@/components/channels/dm-workspace-header";
import { ROOM_MESSAGE_SEARCH_INPUT_ID } from "@/components/chat/room-conversation-search";
import { RoomTypingIndicator } from "@/components/chat/room-typing-indicator";
import { ChatOnboarding } from "@/components/onboarding/chat-onboarding";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  channelTopicTimelineWidthClassName,
  workspaceContentWidthClassName,
} from "@/components/workspace/workspace-page-layout";
import type { RoomMessageSearchHit } from "@/contracts/room-message-search";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import {
  useLibraryPreview,
  useLibraryPreviewSelector,
} from "@/hooks/use-library-preview";
import { useLibraryPreviewPanelWidth } from "@/hooks/use-library-preview-panel-width";
import {
  CHAT_MESSAGES_SCROLL_CONTAINER_ATTR,
  type ChatMessageScrollTarget,
  THREAD_CHANNEL_PANE_SCROLL_ATTR,
  useScrollToChatMessage,
} from "@/hooks/use-scroll-to-chat-message";
import { useChannelThreadTagCatalog } from "@/lib/channels/use-channel-thread-tag-catalog";
import {
  chatScrollSnapshotFromContainer,
  mainTimelineScrollMemoryKey,
  rememberChatTimelineScroll,
  threadChannelPaneScrollMemoryKey,
} from "@/lib/chat/chat-timeline-scroll-memory";
import { resolveChannelInboxListDisplay } from "@/lib/chat/message-preview-text";
import { filterMultiplayerMainTimelineMessages } from "@/lib/chat/room-message-visibility";
import { mergeMessagesForThreadSummaries } from "@/lib/chat/thread-summary";
import {
  normalizeThreadTitle,
  readMessageThreadTags,
  resolveThreadTagsAgainstCatalog,
} from "@/shared/chat/thread-tags";
import type { Attachment, ChatMessage } from "@/shared/types";
import { cn } from "@/shared/utils";
import { Artifact } from "./artifact";
import { ArtifactStreamBridge } from "./artifact-stream-bridge";
import { ChatHeader } from "./chat-header";
import { CitedSourcesPanel } from "./cited-sources-panel";
import { ComposerTaskPanel } from "./composer-task-panel";
import { DataStreamHandler } from "./data-stream-handler";
import { Greeting } from "./greeting";
import { GreetingSuggestions } from "./greeting-suggestions";
import { LibraryPreviewPanel } from "./library-preview-panel";
import { LibraryPreviewResizeHandle } from "./library-preview-resize-handle";
import type { BottomSource } from "./message";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { ThreadConversation } from "./thread-conversation";
import {
  ChannelInboxPaneCollapseToggle,
  THREAD_SPLIT_MAIN_DEFAULT_PERCENT,
} from "./thread-split-resize-handle";

type ActiveSourcesSidebar = {
  messageId: string;
  sources: BottomSource[];
};

export function ChatShell() {
  const {
    chatId,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    input,
    setInput,
    channelTitle,
    dmTitle,
    dmMembers,
    dmPeerDisplayName,
    dmPeerEmail,
    dmPeerImage,
    dmPeerUserId,
    isChannel,
    isDm,
    isGroupDm,
    isMultiplayerRoom,
    isReadonly,
    isLoading,
    messageReactions,
    reactionsUserId,
    currentModelId,
    setCurrentModelId,
    currentReasoningEffort,
    modelReasoningPreferences,
    updateModelReasoningPreference,
    clearConnectorFocus,
    connectorFocus,
    setConnectorFocus,
    currentKnowledgeBase,
    setCurrentKnowledgeBase,
    showCreditCardAlert,
    setShowCreditCardAlert,
    threadReplyCounts,
    threadReplyMessages,
    pendingOpenThreadRootMessageId,
    clearPendingOpenThreadRoot,
    activeRunComposerThreadRootMessageId,
    syncOpenThreadRootMessageId,
    roomTypists,
    sendRoomTypingSignal,
    sessionUserId,
  } = useActiveChat();

  const tenantSlug = useTenantSlug();
  const { catalog: channelThreadTagCatalog } = useChannelThreadTagCatalog(
    isChannel ? chatId : null
  );
  const sessionUser = useSessionUser();
  const [channelWorkspaceView, setChannelWorkspaceView] =
    useState<ChannelWorkspaceView>("messages");
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [channelInboxCollapsed, setChannelInboxCollapsed] = useState(false);

  useEffect(() => {
    if (!isMultiplayerRoom) {
      return;
    }
    void chatId;
    setChannelWorkspaceView("messages");
    setChannelInboxCollapsed(false);
  }, [chatId, isMultiplayerRoom]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeSourcesSidebar, setActiveSourcesSidebar] =
    useState<ActiveSourcesSidebar | null>(null);
  const [activeThreadRootMessageId, setActiveThreadRootMessageId] = useState<
    string | null
  >(null);
  const [scrollTarget, setScrollTarget] =
    useState<ChatMessageScrollTarget | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
    null
  );
  const [channelPaneInput, setChannelPaneInput] = useState("");
  const [channelPaneAttachments, setChannelPaneAttachments] = useState<
    Attachment[]
  >([]);
  const threadSplitRef = useRef<HTMLDivElement>(null);
  const [mainTimelineScrollRestore, setMainTimelineScrollRestore] = useState<
    number | null
  >(null);

  const captureVisibleMainTimelineScroll = useCallback(() => {
    const scrollEl = document.querySelector(
      `[${CHAT_MESSAGES_SCROLL_CONTAINER_ATTR}]:not([${THREAD_CHANNEL_PANE_SCROLL_ATTR}])`
    );
    if (scrollEl instanceof HTMLElement) {
      rememberChatTimelineScroll(
        mainTimelineScrollMemoryKey(chatId),
        chatScrollSnapshotFromContainer(scrollEl)
      );
    }
  }, [chatId]);

  const openThread = useCallback(
    (messageId: string) => {
      captureVisibleMainTimelineScroll();
      setActiveSourcesSidebar(null);
      setActiveThreadRootMessageId(messageId);
    },
    [captureVisibleMainTimelineScroll]
  );

  const closeThread = useCallback(() => {
    const scrollRoot = threadSplitRef.current;
    const scrollEl = scrollRoot?.querySelector(
      `[${THREAD_CHANNEL_PANE_SCROLL_ATTR}]`
    );
    if (scrollEl instanceof HTMLElement) {
      const snapshot = chatScrollSnapshotFromContainer(scrollEl);
      rememberChatTimelineScroll(mainTimelineScrollMemoryKey(chatId), snapshot);
      setMainTimelineScrollRestore(snapshot.scrollTop);
    }
    setScrollTarget(null);
    // Channels keep the list | thread split pinned open (mail-style layout).
    if (isChannel) {
      return;
    }
    setActiveThreadRootMessageId(null);
  }, [chatId, isChannel]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { artifact, setArtifact } = useArtifact();
  const { closePreview: closeLibraryPreview } = useLibraryPreview();
  const isLibraryPreviewVisible = useLibraryPreviewSelector(
    (state) => state.isVisible
  );
  const layoutRef = useRef<HTMLDivElement>(null);
  const {
    panelWidthPercent,
    setPanelWidthPercent,
    chatWidthPercent,
    isResizing,
    setIsResizing,
  } = useLibraryPreviewPanelWidth();

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      // Do NOT stop() here — background chats keep generating (ChatGPT-style).
      setArtifact(initialArtifactData);
      closeLibraryPreview();
      setEditingMessage(null);
      setAttachments([]);
      setActiveSourcesSidebar(null);
      setActiveThreadRootMessageId(null);
      setScrollTarget(null);
      setHighlightMessageId(null);
      setMainTimelineScrollRestore(null);
      setChannelPaneInput("");
      setChannelPaneAttachments([]);
      clearPendingOpenThreadRoot();
    }
  }, [chatId, clearPendingOpenThreadRoot, closeLibraryPreview, setArtifact]);

  useEffect(() => {
    if (!isMultiplayerRoom) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "f"
      ) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      document.getElementById(ROOM_MESSAGE_SEARCH_INPUT_ID)?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMultiplayerRoom]);

  useEffect(() => {
    if (!pendingOpenThreadRootMessageId) {
      return;
    }
    setActiveThreadRootMessageId(pendingOpenThreadRootMessageId);
    clearPendingOpenThreadRoot();
  }, [clearPendingOpenThreadRoot, pendingOpenThreadRootMessageId]);

  useEffect(() => {
    syncOpenThreadRootMessageId(activeThreadRootMessageId);
  }, [activeThreadRootMessageId, syncOpenThreadRootMessageId]);

  const prevThreadScrollRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeThreadRootMessageId) {
      prevThreadScrollRef.current = null;
      return;
    }
    if (prevThreadScrollRef.current === activeThreadRootMessageId) {
      return;
    }
    prevThreadScrollRef.current = activeThreadRootMessageId;

    const scrollToThreadRoot = () => {
      setScrollTarget({
        behavior: "instant",
        force: true,
        highlight: false,
        messageId: activeThreadRootMessageId,
        nonce: Date.now(),
      });
    };

    scrollToThreadRoot();
    const timers = [50, 200, 500, 1000].map((delay) =>
      window.setTimeout(scrollToThreadRoot, delay)
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [activeThreadRootMessageId]);

  const dmDisplayTitle =
    isGroupDm && dmTitle
      ? dmTitle
      : dmPeerDisplayName
        ? dmPeerDisplayName
        : null;

  const mainRoomComposerPlaceholder = isMultiplayerRoom
    ? isChannel && channelTitle
      ? `Message in ${channelTitle}`
      : dmDisplayTitle
        ? `Message in ${dmDisplayTitle}`
        : "Message…"
    : undefined;

  useScrollToChatMessage({
    onClearScrollTarget: () => setScrollTarget(null),
    onScrolled: (messageId, { highlight }) => {
      if (!highlight) {
        return;
      }
      setHighlightMessageId(messageId);
      window.setTimeout(() => setHighlightMessageId(null), 2500);
    },
    scrollTarget,
  });

  const scrollRetryKey = `${messages.length}:${activeThreadRootMessageId ?? ""}`;

  useEffect(() => {
    if (!scrollTarget) {
      return;
    }
    void scrollRetryKey;
    const timer = window.setTimeout(() => {
      setScrollTarget((current) =>
        current?.messageId === scrollTarget.messageId
          ? { ...current, nonce: Date.now() }
          : current
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [scrollTarget, scrollRetryKey]);

  function handleRoomSearchHit(hit: RoomMessageSearchHit) {
    setChannelWorkspaceView("messages");
    if (hit.threadRootMessageId) {
      openThread(hit.threadRootMessageId);
    } else {
      setActiveThreadRootMessageId(null);
    }
    setScrollTarget({
      highlight: true,
      messageId: hit.messageId,
      nonce: Date.now(),
    });
  }

  const mainTimelineMessages = useMemo(
    () =>
      isMultiplayerRoom
        ? filterMultiplayerMainTimelineMessages(messages)
        : messages,
    [isMultiplayerRoom, messages]
  );

  const allChatMessagesForSummaries = useMemo(
    () => mergeMessagesForThreadSummaries(messages, threadReplyMessages),
    [messages, threadReplyMessages]
  );

  useEffect(() => {
    if (isArtifactVisible && isLibraryPreviewVisible) {
      closeLibraryPreview();
    }
  }, [closeLibraryPreview, isArtifactVisible, isLibraryPreviewVisible]);

  const isSourcesSidebarVisible =
    !isArtifactVisible &&
    !isLibraryPreviewVisible &&
    activeSourcesSidebar !== null &&
    activeSourcesSidebar.sources.length > 0;

  const isChannelTopicLayout = isChannel && channelWorkspaceView === "messages";

  /** Channel #messages is always list (left) + thread (right). */
  const isChannelInboxSplit = isChannelTopicLayout && isMultiplayerRoom;

  const isThreadMainView =
    isChannelInboxSplit ||
    (isMultiplayerRoom && activeThreadRootMessageId !== null);

  useEffect(() => {
    if (!isChannelInboxSplit) {
      return;
    }
    if (mainTimelineMessages.length === 0) {
      setActiveThreadRootMessageId(null);
      return;
    }
    const selectedId = activeThreadRootMessageId;
    const selectionStillValid =
      selectedId != null &&
      mainTimelineMessages.some((message) => message.id === selectedId);
    if (selectionStillValid) {
      return;
    }
    const latestRoot = mainTimelineMessages.at(-1);
    if (latestRoot) {
      setActiveThreadRootMessageId(latestRoot.id);
    }
  }, [activeThreadRootMessageId, isChannelInboxSplit, mainTimelineMessages]);

  /** Connector tool scope applies to the active composer (thread), not the main timeline draft. */
  const channelPaneConnectorProps = isThreadMainView
    ? {
        connectorFocus: null,
        onClearConnectorFocus: undefined,
        onConnectorFocusChange: undefined,
      }
    : {
        connectorFocus,
        onClearConnectorFocus: clearConnectorFocus,
        onConnectorFocusChange: setConnectorFocus,
      };

  useEffect(() => {
    if (!activeThreadRootMessageId) {
      return;
    }
    clearConnectorFocus();
  }, [activeThreadRootMessageId, clearConnectorFocus]);

  const activeThreadHeaderMeta =
    useMemo((): ChannelThreadSplitHeaderMeta | null => {
      if (!activeThreadRootMessageId) {
        return null;
      }
      const root = messages.find(
        (message) => message.id === activeThreadRootMessageId
      );
      if (!root) {
        return null;
      }
      const explicitTitle = root.metadata?.threadTitle?.trim();
      const tags = resolveThreadTagsAgainstCatalog(
        readMessageThreadTags(root.metadata),
        channelThreadTagCatalog
      );
      const title = explicitTitle
        ? (normalizeThreadTitle(explicitTitle) ?? explicitTitle)
        : resolveChannelInboxListDisplay(root, tags).title;

      const authorName =
        root.role === "assistant"
          ? (root.metadata?.agentName?.trim() ?? "Kimiro")
          : (root.metadata?.authorDisplayName?.trim() ??
            root.metadata?.authorEmail?.trim() ??
            "Member");

      return {
        authorEmail: root.metadata?.authorEmail,
        authorImage: root.metadata?.authorImage,
        authorName,
        authorUserId: root.metadata?.authorAuthUserId,
        title,
      };
    }, [activeThreadRootMessageId, channelThreadTagCatalog, messages]);

  const showDmThreadSplitHeader =
    isThreadMainView &&
    isDm &&
    Boolean(dmDisplayTitle) &&
    channelWorkspaceView === "messages";

  const isRightPanelVisible =
    !isArtifactVisible && (isSourcesSidebarVisible || isLibraryPreviewVisible);

  const isCenteredNewChat =
    !isReadonly &&
    !isLoading &&
    mainTimelineMessages.length === 0 &&
    !isArtifactVisible &&
    !isMultiplayerRoom;

  let artifactEmptyHint = "Ask about this document…";
  if (artifact.kind === "sheet") {
    artifactEmptyHint = "Ask about this spreadsheet…";
  } else if (artifact.kind === "code") {
    artifactEmptyHint = "Ask about this code…";
  } else if (artifact.kind === "image") {
    artifactEmptyHint = "Ask about this image…";
  }

  const onboarding = useOnboarding();
  const { isOnboardingGateActive } = onboarding;

  const composerProps = {
    attachments,
    chatId,
    composerBlocked: onboarding.isChatComposerBlocked,
    composerBlockedMessage: onboarding.composerBlockedMessage,
    input,
    isChannel,
    isMultiplayerRoom,
    isLoading,
    sendRoomTypingSignal,
    typingThreadRootMessageId: null,
    connectorFocus,
    knowledgeBase: currentKnowledgeBase,
    onClearConnectorFocus: clearConnectorFocus,
    onConnectorFocusChange: setConnectorFocus,
    messages: mainTimelineMessages,
    modelReasoningPreferences,
    onKnowledgeBaseChange: setCurrentKnowledgeBase,
    onModelChange: setCurrentModelId,
    onModelReasoningPreferenceChange: updateModelReasoningPreference,
    placeholder: mainRoomComposerPlaceholder,
    reasoningEffort: currentReasoningEffort,
    selectedModelId: currentModelId,
    sendMessage,
    setAttachments,
    setInput,
    setMessages,
    status,
    stop,
  } as const;

  const roomConversationSearch = isMultiplayerRoom
    ? {
        chatId,
        onSelectHit: handleRoomSearchHit,
      }
    : undefined;

  const roomWorkspaceHeader =
    isDm && dmDisplayTitle ? (
      <DmWorkspaceHeader
        chatId={chatId}
        conversationSearch={roomConversationSearch}
        isGroup={isGroupDm}
        members={dmMembers}
        onViewChange={(nextView) => setChannelWorkspaceView(nextView)}
        peerDisplayName={dmPeerDisplayName}
        peerEmail={dmPeerEmail}
        peerImage={dmPeerImage}
        peerUserId={dmPeerUserId}
        title={dmDisplayTitle}
        view={
          channelWorkspaceView === "library"
            ? "library"
            : channelWorkspaceView === "kb"
              ? "kb"
              : "messages"
        }
      />
    ) : isChannel && channelTitle ? (
      <ChannelWorkspaceHeader
        channelId={chatId}
        channelTitle={channelTitle}
        conversationSearch={roomConversationSearch}
        isReadonly={isReadonly}
        onViewChange={setChannelWorkspaceView}
        view={channelWorkspaceView}
      />
    ) : null;

  const dmThreadSplitHeader =
    isDm && dmDisplayTitle && isThreadMainView ? (
      <DmThreadSplitHeader
        channelPaneWidthPercent={THREAD_SPLIT_MAIN_DEFAULT_PERCENT}
        chatId={chatId}
        conversationSearch={roomConversationSearch}
        isGroup={isGroupDm}
        members={dmMembers}
        onCloseThread={closeThread}
        onViewChange={(nextView) => setChannelWorkspaceView(nextView)}
        peerDisplayName={dmPeerDisplayName}
        peerEmail={dmPeerEmail}
        peerImage={dmPeerImage}
        peerUserId={dmPeerUserId}
        threadReplyCount={
          activeThreadRootMessageId
            ? (threadReplyCounts[activeThreadRootMessageId] ?? 0)
            : 0
        }
        title={dmDisplayTitle}
        view={
          channelWorkspaceView === "library"
            ? "library"
            : channelWorkspaceView === "kb"
              ? "kb"
              : "messages"
        }
      />
    ) : null;

  return (
    <>
      <div
        className="flex h-dvh w-full flex-row overflow-hidden"
        ref={layoutRef}
      >
        <div
          className={cn(
            "flex min-w-0 flex-col bg-background",
            isLibraryPreviewVisible
              ? "shrink-0"
              : "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isArtifactVisible
              ? "w-[40%]"
              : isLibraryPreviewVisible
                ? "min-w-0 max-md:hidden"
                : isRightPanelVisible
                  ? "w-[calc(100%-420px)]"
                  : "w-full"
          )}
          style={
            isLibraryPreviewVisible && !isArtifactVisible
              ? {
                  transition: isResizing
                    ? "none"
                    : "width 300ms cubic-bezier(0.32, 0.72, 0, 1)",
                  width: `${chatWidthPercent}%`,
                }
              : undefined
          }
        >
          <div
            className={cn(
              isOnboardingGateActive &&
                "pointer-events-none select-none opacity-60"
            )}
          >
            <ChatHeader />
          </div>

          {showDmThreadSplitHeader
            ? dmThreadSplitHeader
            : isChannelInboxSplit
              ? null
              : roomWorkspaceHeader}

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            {isMultiplayerRoom && channelWorkspaceView === "kb" ? (
              currentKnowledgeBase?.id && sessionUser ? (
                <ChannelFilesLinksPanel
                  knowledgeBaseId={currentKnowledgeBase.id}
                  tenantSlug={tenantSlug}
                  viewerEmail={sessionUser.email ?? ""}
                  viewerUserId={sessionUser.id}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <div
                    className={cn(
                      workspaceContentWidthClassName,
                      "flex flex-1 items-center justify-center py-12 text-muted-foreground text-sm"
                    )}
                  >
                    Loading knowledge base…
                  </div>
                </div>
              )
            ) : null}

            {isMultiplayerRoom &&
            channelWorkspaceView === "library" &&
            tenantSlug ? (
              <ChannelLibraryPanel chatId={chatId} tenantSlug={tenantSlug} />
            ) : null}

            {isMultiplayerRoom && channelWorkspaceView !== "messages" ? null : (
              <div
                className={cn(
                  "relative flex min-h-0 flex-1 overflow-hidden",
                  isThreadMainView ? "flex-row gap-px bg-border/60" : "flex-col"
                )}
                ref={threadSplitRef}
              >
                {isThreadMainView && isChannelInboxSplit ? (
                  <ChannelInboxPaneCollapseToggle
                    collapsed={channelInboxCollapsed}
                    listPaneWidthPercent={THREAD_SPLIT_MAIN_DEFAULT_PERCENT}
                    onToggle={() => setChannelInboxCollapsed((value) => !value)}
                  />
                ) : null}
                {isThreadMainView ? (
                  <div
                    className={cn(
                      "flex min-h-0 shrink-0 flex-col overflow-hidden bg-background transition-[width] duration-200 ease-out",
                      channelInboxCollapsed ? "w-0 min-w-0" : "min-w-0"
                    )}
                    style={
                      channelInboxCollapsed
                        ? undefined
                        : {
                            width: `${THREAD_SPLIT_MAIN_DEFAULT_PERCENT}%`,
                          }
                    }
                  >
                    {isChannelInboxSplit && channelTitle ? (
                      <ChannelWorkspaceHeader
                        channelId={chatId}
                        channelTitle={channelTitle}
                        compact
                        conversationSearch={roomConversationSearch}
                        embedded
                        isReadonly={isReadonly}
                        onViewChange={setChannelWorkspaceView}
                        view={channelWorkspaceView}
                      />
                    ) : null}
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                      {mainTimelineMessages.length === 0 && !isLoading ? (
                        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center">
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Main channel messages appear here. Replies stay in
                            the thread on the right.
                          </p>
                        </div>
                      ) : (
                        <Messages
                          activeRunComposerThreadRootMessageId={
                            activeRunComposerThreadRootMessageId
                          }
                          allChatMessages={allChatMessagesForSummaries}
                          channelInboxListReverse={true}
                          channelThreadTagCatalog={channelThreadTagCatalog}
                          chatId={chatId}
                          editingMessage={null}
                          highlightMessageId={highlightMessageId}
                          isArtifactVisible={false}
                          isChannelTopicLayout={isChannelTopicLayout}
                          isLoading={isLoading}
                          isMultiplayerRoom={isMultiplayerRoom}
                          isReadonly={true}
                          messageReactions={messageReactions}
                          messages={mainTimelineMessages}
                          onOpenThread={openThread}
                          openThreadRootMessageId={activeThreadRootMessageId}
                          pinToLatestOnMount={false}
                          reactionsUserId={reactionsUserId}
                          regenerate={regenerate}
                          scrollMemoryKey={threadChannelPaneScrollMemoryKey(
                            chatId
                          )}
                          selectedModelId={currentModelId}
                          setMessages={setMessages}
                          showThreadActions={isMultiplayerRoom}
                          status={status}
                          threadChannelPaneScroll
                          threadReplyCounts={threadReplyCounts}
                          viewThreadRootMessageId={null}
                        />
                      )}
                      {isReadonly ? null : isChannelInboxSplit ? (
                        <ChannelStartConversationFab
                          channelTitle={channelTitle ?? undefined}
                          onStarted={openThread}
                          sendMessage={sendMessage}
                        />
                      ) : (
                        <div className="chat-area-interactive sticky bottom-0 z-1 mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-0 bg-background px-2 pb-6 md:px-4 md:pb-8">
                          <ComposerTaskPanel messages={mainTimelineMessages} />
                          {isMultiplayerRoom ? (
                            <RoomTypingIndicator
                              currentUserId={sessionUserId}
                              roomTypists={roomTypists}
                              threadRootMessageId={null}
                            />
                          ) : null}
                          <MultimodalInput
                            {...composerProps}
                            {...channelPaneConnectorProps}
                            attachments={channelPaneAttachments}
                            autoFocus={false}
                            className="w-full"
                            draftStorageKey={`room-channel-${chatId}`}
                            input={channelPaneInput}
                            setAttachments={setChannelPaneAttachments}
                            setInput={setChannelPaneInput}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div
                  className={cn(
                    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                    isThreadMainView &&
                      "bg-background max-md:border-border/60 max-md:border-l"
                  )}
                >
                  {isChannelInboxSplit && activeThreadHeaderMeta ? (
                    <ChannelThreadPaneHeader
                      threadMeta={activeThreadHeaderMeta}
                    />
                  ) : null}
                  {isThreadMainView && activeThreadRootMessageId ? (
                    <ThreadConversation
                      hideHeader
                      highlightMessageId={highlightMessageId}
                      key={activeThreadRootMessageId}
                      onClose={closeThread}
                      onOpenSourcesSidebar={({ messageId, sources }) => {
                        setActiveSourcesSidebar({ messageId, sources });
                      }}
                      threadRootMessageId={activeThreadRootMessageId}
                    />
                  ) : isChannelInboxSplit ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                      <p className="font-medium text-foreground text-sm">
                        {channelTitle
                          ? `This is the beginning of #${channelTitle}`
                          : "Channel"}
                      </p>
                      <p className="mt-2 max-w-sm text-muted-foreground text-sm leading-relaxed">
                        Post in the channel to open a thread here, or pick a
                        topic from the list on the left.
                      </p>
                    </div>
                  ) : isCenteredNewChat ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-2 py-8 pb-56 md:pb-72 md:px-4">
                        {isOnboardingGateActive ? (
                          <div
                            aria-hidden
                            className="absolute inset-0 z-10 rounded-xl bg-background/50"
                          />
                        ) : null}
                        <div
                          className={cn(
                            "relative z-20 flex flex-col gap-4",
                            isOnboardingGateActive && "pointer-events-none"
                          )}
                        >
                          <Greeting />
                          {onboarding.showProfileOnboarding ? (
                            <div className="pointer-events-auto">
                              <ChatOnboarding onboarding={onboarding} />
                            </div>
                          ) : null}
                          <div className="flex flex-col gap-4">
                            <MultimodalInput
                              {...composerProps}
                              className="w-full"
                            />
                            <div className="relative h-23 shrink-0">
                              <GreetingSuggestions
                                className="absolute inset-x-0 top-0"
                                disabled={onboarding.isChatComposerBlocked}
                                hidden={Boolean(input.trim())}
                                onSelect={setInput}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isChannelTopicLayout && !isChannelInboxSplit ? (
                    <div
                      className={cn(
                        channelTopicTimelineWidthClassName,
                        "chat-area-interactive relative flex min-h-0 flex-1 flex-col"
                      )}
                    >
                      {isMultiplayerRoom &&
                      mainTimelineMessages.length === 0 &&
                      !isLoading ? (
                        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-40 text-center">
                          <p className="font-medium text-foreground text-sm">
                            {channelTitle
                              ? `This is the beginning of #${channelTitle}`
                              : "Channel"}
                          </p>
                          <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
                            Message teammates here anytime. Mention{" "}
                            <span className="font-medium text-foreground">
                              @Kimiro
                            </span>{" "}
                            when you want the assistant to jump in.
                          </p>
                        </div>
                      ) : (
                        <Messages
                          activeRunComposerThreadRootMessageId={
                            activeRunComposerThreadRootMessageId
                          }
                          allChatMessages={allChatMessagesForSummaries}
                          channelThreadTagCatalog={channelThreadTagCatalog}
                          chatId={chatId}
                          editingMessage={editingMessage}
                          highlightMessageId={highlightMessageId}
                          initialScrollTop={mainTimelineScrollRestore}
                          isArtifactVisible={isArtifactVisible}
                          isChannelTopicLayout
                          isLoading={isLoading}
                          isMultiplayerRoom={isMultiplayerRoom}
                          isReadonly={isReadonly}
                          messageReactions={messageReactions}
                          messages={mainTimelineMessages}
                          onCancelEdit={() => setEditingMessage(null)}
                          onEditMessage={(msg) => setEditingMessage(msg)}
                          onInitialScrollApplied={() =>
                            setMainTimelineScrollRestore(null)
                          }
                          onOpenSourcesSidebar={({ messageId, sources }) => {
                            setActiveSourcesSidebar({ messageId, sources });
                          }}
                          onOpenThread={openThread}
                          onSubmitEdit={async (message, text) => {
                            setEditingMessage(null);
                            await submitEditedMessage({
                              message,
                              sendMessage,
                              text,
                            });
                          }}
                          pinToLatestOnMount={
                            mainTimelineScrollRestore === null
                          }
                          reactionsUserId={reactionsUserId}
                          regenerate={regenerate}
                          scrollMemoryKey={mainTimelineScrollMemoryKey(chatId)}
                          selectedModelId={currentModelId}
                          setMessages={setMessages}
                          showThreadActions={isMultiplayerRoom}
                          status={status}
                          threadReplyCounts={threadReplyCounts}
                          viewThreadRootMessageId={null}
                        />
                      )}

                      {isArtifactVisible &&
                      mainTimelineMessages.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-0 flex justify-center px-4">
                          <p className="text-center text-muted-foreground text-sm">
                            {artifactEmptyHint}
                          </p>
                        </div>
                      ) : null}

                      <div className="chat-area-interactive sticky bottom-0 z-1 flex w-full shrink-0 flex-col gap-2 border-t-0 bg-background pb-6 md:pb-8">
                        {isReadonly ? null : (
                          <ComposerTaskPanel messages={mainTimelineMessages} />
                        )}
                        {isMultiplayerRoom ? (
                          <RoomTypingIndicator
                            currentUserId={sessionUserId}
                            roomTypists={roomTypists}
                            threadRootMessageId={null}
                          />
                        ) : null}
                        {isReadonly ? null : (
                          <MultimodalInput
                            {...composerProps}
                            className="w-full"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {isMultiplayerRoom &&
                      mainTimelineMessages.length === 0 &&
                      !isLoading ? (
                        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-40 text-center">
                          <p className="font-medium text-foreground text-sm">
                            {isChannel && channelTitle
                              ? `This is the beginning of #${channelTitle}`
                              : dmDisplayTitle
                                ? isGroupDm
                                  ? `This is the start of your group conversation (${dmDisplayTitle})`
                                  : `This is the start of your conversation with ${dmDisplayTitle}`
                                : "Conversation"}
                          </p>
                          <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
                            Message teammates here anytime. Mention{" "}
                            <span className="font-medium text-foreground">
                              @Kimiro
                            </span>{" "}
                            when you want the assistant to jump in.
                          </p>
                        </div>
                      ) : (
                        <Messages
                          activeRunComposerThreadRootMessageId={
                            activeRunComposerThreadRootMessageId
                          }
                          allChatMessages={allChatMessagesForSummaries}
                          chatId={chatId}
                          editingMessage={editingMessage}
                          highlightMessageId={highlightMessageId}
                          initialScrollTop={mainTimelineScrollRestore}
                          isArtifactVisible={isArtifactVisible}
                          isLoading={isLoading}
                          isMultiplayerRoom={isMultiplayerRoom}
                          isReadonly={isReadonly}
                          messageReactions={messageReactions}
                          messages={mainTimelineMessages}
                          onCancelEdit={() => setEditingMessage(null)}
                          onEditMessage={(msg) => setEditingMessage(msg)}
                          onInitialScrollApplied={() =>
                            setMainTimelineScrollRestore(null)
                          }
                          onOpenSourcesSidebar={({ messageId, sources }) => {
                            setActiveSourcesSidebar({ messageId, sources });
                          }}
                          onOpenThread={openThread}
                          onSubmitEdit={async (message, text) => {
                            setEditingMessage(null);
                            await submitEditedMessage({
                              message,
                              sendMessage,
                              text,
                            });
                          }}
                          pinToLatestOnMount={
                            mainTimelineScrollRestore === null
                          }
                          reactionsUserId={reactionsUserId}
                          regenerate={regenerate}
                          scrollMemoryKey={mainTimelineScrollMemoryKey(chatId)}
                          selectedModelId={currentModelId}
                          setMessages={setMessages}
                          showThreadActions={isMultiplayerRoom}
                          status={status}
                          threadReplyCounts={threadReplyCounts}
                          viewThreadRootMessageId={null}
                        />
                      )}

                      {isArtifactVisible &&
                      mainTimelineMessages.length === 0 ? (
                        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-0 flex justify-center px-4">
                          <p className="text-center text-muted-foreground text-sm">
                            {artifactEmptyHint}
                          </p>
                        </div>
                      ) : null}

                      <div className="chat-area-interactive sticky bottom-0 z-1 mx-auto flex w-full max-w-3xl flex-col gap-2 border-t-0 bg-background px-2 pb-6 md:px-4 md:pb-8">
                        {isReadonly ? null : (
                          <ComposerTaskPanel messages={mainTimelineMessages} />
                        )}
                        {isMultiplayerRoom ? (
                          <RoomTypingIndicator
                            currentUserId={sessionUserId}
                            roomTypists={roomTypists}
                            threadRootMessageId={null}
                          />
                        ) : null}
                        {isReadonly ? null : (
                          <MultimodalInput {...composerProps} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {isSourcesSidebarVisible ? (
          <div className="flex h-dvh w-105 shrink-0 flex-col border-l border-border bg-background">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="font-medium text-base text-foreground">
                References
              </p>
              <button
                aria-label="Close references"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setActiveSourcesSidebar(null);
                }}
                type="button"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
              <CitedSourcesPanel sources={activeSourcesSidebar.sources} />
            </div>
          </div>
        ) : null}

        {isLibraryPreviewVisible ? (
          <LibraryPreviewResizeHandle
            containerRef={layoutRef}
            onResizeEnd={() => {
              setIsResizing(false);
            }}
            onResizeStart={() => {
              setIsResizing(true);
            }}
            onWidthChange={setPanelWidthPercent}
            panelWidthPercent={panelWidthPercent}
          />
        ) : null}

        <LibraryPreviewPanel
          isResizing={isResizing}
          panelWidthPercent={panelWidthPercent}
        />

        <Artifact
          attachments={attachments}
          chatId={chatId}
          input={input}
          isReadonly={isReadonly}
          messageReactions={messageReactions}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
        />
      </div>

      <DataStreamHandler />
      <ArtifactStreamBridge chatId={chatId} />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = `${process.env.KIMIRO_BASE_PATH ?? ""}/`;
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
