"use client";

import { XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { ThreadTagsHeader } from "@/components/channels/thread-tags-header";
import { ComposerTaskPanel } from "@/components/chat/composer-task-panel";
import type { BottomSource } from "@/components/chat/message";
import { Messages } from "@/components/chat/messages";
import { MultimodalInput } from "@/components/chat/multimodal-input";
import { RoomTypingIndicator } from "@/components/chat/room-typing-indicator";
import { Button } from "@/components/ui/button";
import { workspaceContentWidthClassName } from "@/components/workspace/workspace-page-layout";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useChannelThreadTagCatalog } from "@/lib/channels/use-channel-thread-tag-catalog";
import { roomThreadScrollMemoryKey } from "@/lib/chat/chat-timeline-scroll-memory";
import { filterMultiplayerThreadMessages } from "@/lib/chat/room-message-visibility";
import { mergeRoomThreadMessages } from "@/lib/chat/room-thread-message-merge";
import type { Attachment, ChatMessage } from "@/shared/types";
import { cn, fetcher } from "@/shared/utils";

export function ThreadConversation({
  threadRootMessageId,
  onClose,
  onOpenSourcesSidebar,
  className,
  highlightMessageId = null,
  hideHeader = false,
}: {
  threadRootMessageId: string;
  highlightMessageId?: string | null;
  hideHeader?: boolean;
  onClose: () => void;
  onOpenSourcesSidebar?: (payload: {
    messageId: string;
    sources: BottomSource[];
  }) => void;
  className?: string;
}) {
  const {
    chatId,
    messages: allMessages,
    status,
    messageReactions,
    reactionsUserId,
    isReadonly,
    isChannel,
    isMultiplayerRoom,
    sendMessage,
    setMessages,
    regenerate,
    currentModelId,
    setCurrentModelId,
    currentReasoningEffort,
    modelReasoningPreferences,
    updateModelReasoningPreference,
    currentKnowledgeBase,
    setCurrentKnowledgeBase,
    input,
    setInput,
    isLoading,
    stop,
    roomTypists,
    sendRoomTypingSignal,
    sessionUserId,
    connectorFocus,
    clearConnectorFocus,
    setConnectorFocus,
    activeRunComposerThreadRootMessageId,
    threadReplyCounts,
  } = useActiveChat();

  const { catalog: channelThreadTagCatalog } = useChannelThreadTagCatalog(
    isChannel ? chatId : null
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const threadMessagesKey = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/messages?chatId=${chatId}&threadRootMessageId=${threadRootMessageId}`;

  const { data: threadData } = useSWR<{ messages: ChatMessage[] }>(
    threadMessagesKey,
    fetcher,
    { revalidateOnFocus: true }
  );

  const threadMessages = useMemo(
    () =>
      filterMultiplayerThreadMessages(
        mergeRoomThreadMessages({
          liveMessages: allMessages,
          serverMessages: threadData?.messages ?? [],
          threadRootMessageId,
        }),
        { threadRootMessageId }
      ),
    [allMessages, threadData?.messages, threadRootMessageId]
  );

  const composerProps = {
    attachments,
    chatId,
    input,
    isChannel,
    isLoading,
    isMultiplayerRoom,
    sendRoomTypingSignal,
    typingThreadRootMessageId: threadRootMessageId,
    connectorFocus,
    onClearConnectorFocus: clearConnectorFocus,
    onConnectorFocusChange: setConnectorFocus,
    knowledgeBase: currentKnowledgeBase,
    messages: threadMessages,
    modelReasoningPreferences,
    onKnowledgeBaseChange: setCurrentKnowledgeBase,
    onModelChange: setCurrentModelId,
    onModelReasoningPreferenceChange: updateModelReasoningPreference,
    reasoningEffort: currentReasoningEffort,
    selectedModelId: currentModelId,
    sendMessage: (message: Parameters<typeof sendMessage>[0]) =>
      sendMessage({
        ...message,
        threadRootMessageId,
      }),
    setAttachments,
    setInput,
    setMessages,
    status,
    stop,
  } as const;

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
    >
      {hideHeader ? null : (
        <header className="sticky top-0 z-10 flex min-h-12 shrink-0 items-center gap-2 bg-background/95 px-3 py-2 backdrop-blur-sm md:px-4">
          <h2 className="shrink-0 font-semibold text-[15px] text-foreground">
            Thread
          </h2>
          {isChannel ? (
            <ThreadTagsHeader
              catalog={channelThreadTagCatalog}
              chatId={chatId}
              isReadonly={isReadonly}
              messages={allMessages}
              rootMessageId={threadRootMessageId}
              setMessages={setMessages}
            />
          ) : null}
          <Button
            aria-label="Close thread"
            className="ml-auto size-9 shrink-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-4.5" />
          </Button>
        </header>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Messages
          activeRunComposerThreadRootMessageId={
            activeRunComposerThreadRootMessageId
          }
          chatId={chatId}
          highlightMessageId={highlightMessageId}
          isArtifactVisible={false}
          isChannelThreadLayout={isChannel}
          isLoading={isLoading}
          isMultiplayerRoom={isMultiplayerRoom}
          isReadonly={isReadonly}
          messageReactions={messageReactions ?? []}
          messages={threadMessages}
          onOpenSourcesSidebar={
            onOpenSourcesSidebar
              ? ({ messageId, sources }) =>
                  onOpenSourcesSidebar({ messageId, sources })
              : undefined
          }
          reactionsUserId={reactionsUserId}
          regenerate={regenerate}
          scrollMemoryKey={roomThreadScrollMemoryKey(
            chatId,
            threadRootMessageId
          )}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          showThreadActions={false}
          status={status}
          threadReplyCounts={threadReplyCounts}
          viewThreadRootMessageId={threadRootMessageId}
        />
        <div
          className={cn(
            "chat-area-interactive sticky bottom-0 z-1 flex w-full flex-col gap-2 border-t-0 bg-background pb-6 md:pb-8",
            workspaceContentWidthClassName
          )}
        >
          {isReadonly ? null : <ComposerTaskPanel messages={threadMessages} />}
          {isMultiplayerRoom ? (
            <RoomTypingIndicator
              currentUserId={sessionUserId}
              roomTypists={roomTypists}
              threadRootMessageId={threadRootMessageId}
            />
          ) : null}
          {isReadonly ? null : (
            <MultimodalInput
              {...composerProps}
              className="w-full"
              draftStorageKey={`room-thread-${chatId}-${threadRootMessageId}`}
              placeholder={isChannel ? "Reply in thread" : "Reply…"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
