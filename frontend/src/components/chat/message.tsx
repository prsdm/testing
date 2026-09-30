"use client";
import equal from "fast-deep-equal";
import { memo } from "react";
import {
  ChannelTopicMessageCard,
  ChannelTopicMessageRow,
} from "@/components/channels/channel-topic-message-card";
import { ThreadTagPillRow } from "@/components/channels/thread-tag-pill";
import { useSessionUser } from "@/components/providers/session-user-provider";
import {
  channelTopicAvatarClassName,
  channelTopicInboxAvatarClassName,
} from "@/components/workspace/workspace-page-layout";
import type { MessageReaction } from "@/contracts/message-reactions";
import { useArtifact } from "@/hooks/use-artifact";
import { useProfileOnboardingStatus } from "@/hooks/use-profile-onboarding-status";
import { chatMessageDomId } from "@/hooks/use-scroll-to-chat-message";
import type { ChatHelpers, ChatSetMessages } from "@/lib/chat/chat-helpers";
import {
  isChannelEmptyRootBodyText,
  resolveChannelInboxListDisplay,
} from "@/lib/chat/message-preview-text";
import {
  getSourceMetadataLabel,
  truncateSourceSnippet,
} from "@/lib/chat/source-display";
import type { ThreadSummary } from "@/lib/chat/thread-summary";
import {
  extractWebSourceDetails,
  getRenderedWebSources,
  getWebSourceDisplayTitle,
  type WebSource,
  type WebSourceDetail,
} from "@/lib/chat/web-search-parts";
import { hasAssistantAnswerText } from "@/shared/chat/activity-parts";
import { messageHasInlineToolApproval } from "@/shared/chat/apply-tool-approval-response";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import {
  USER_OWN_MESSAGE_BUBBLE_CLASS,
  USER_PEER_MESSAGE_BUBBLE_CLASS,
} from "@/shared/chat/mention-styles";
import { reactionsForMessage } from "@/shared/chat/message-reaction-groups";
import {
  readMessageThreadTags,
  resolveThreadTagsAgainstCatalog,
  type ThreadTag,
} from "@/shared/chat/thread-tags";
import { resolveRoomMessageAuthorDisplayName } from "@/shared/kimiro-user-name";
import type { CitedDocument } from "@/shared/search/citations";
import {
  collectCitationsFromMessageParts,
  getCitationBadgeKind,
} from "@/shared/search/citations";
import type { SearchResultSourceType } from "@/shared/search/types";
import type { ChatMessage } from "@/shared/types";
import { cn, sanitizeText } from "@/shared/utils";
import { MessageContent } from "../ai-elements/message";
import { resolveConnectorProviderIcon } from "../connectors/connector-provider-icon";
import { activityChipClassName } from "./activity-chip-list";
import { AssistantInlineStream } from "./assistant-inline-stream";
import { AssistantMessageLayout } from "./assistant-message-header";
import { ConnectorConnectButton } from "./connector-connect-button";
import { useDataStream } from "./data-stream-provider";
import { DocumentSelectionChip } from "./document-selection-chip";
import { AssistantIconTile, KimiroIconTile } from "./kimiro-icon";
import { MessageActions } from "./message-actions";
import { UserMessageEditor } from "./message-editor";
import { MessageReactionChips } from "./message-reactions";
import { MessageThreadFooter } from "./message-thread-footer";
import { MessageThreadReply } from "./message-thread-reply";
import { MessageTimestamp } from "./message-timestamp";
import { PreviewAttachment } from "./preview-attachment";
import { RoomMemberMessageLayout } from "./room-member-message-header";
import { SourceBadgeIcon } from "./source-badge-icon";
import { UserAvatar } from "./user-avatar";
import { UserMessageConnectorBody } from "./user-message-connector-body";
import { WorkflowRunActions } from "./workflow-run-actions";

export type BottomSource = {
  key: string;
  title: string;
  snippet?: string;
  url?: string;
  kind: "source" | "web" | "api";
  sourceConnectorType?: CitedDocument["sourceConnectorType"];
  sourceType?: SearchResultSourceType;
  metadataLabel?: string;
  updatedAt?: string;
  ageLabel?: string;
};

function buildBottomSources({
  kbCitations,
  webSources,
  webSourceDetails,
}: {
  kbCitations: Record<number, CitedDocument>;
  webSources: WebSource[];
  webSourceDetails: Map<string, WebSourceDetail>;
}) {
  const sources: BottomSource[] = [];
  const usedUrls = new Set<string>();

  const kbEntries = Object.entries(kbCitations)
    .map(([rawNumber, doc]) => ({
      doc,
      number: Number.parseInt(rawNumber, 10),
    }))
    .filter((entry): entry is { number: number; doc: CitedDocument } =>
      Number.isFinite(entry.number)
    )
    .sort((a, b) => a.number - b.number);

  for (const entry of kbEntries) {
    const url = entry.doc.link?.trim();
    const citationKind = getCitationBadgeKind(entry.doc);
    if (url) {
      usedUrls.add(url);
    }
    sources.push({
      key: `${citationKind}:${entry.doc.documentId}:${entry.number}`,
      kind: citationKind,
      metadataLabel: getSourceMetadataLabel({
        kind: citationKind,
        sourceConnectorType: entry.doc.sourceConnectorType,
        sourceType:
          entry.doc.sourceType === "web" ? undefined : entry.doc.sourceType,
        url: entry.doc.link,
      }),
      snippet: truncateSourceSnippet(entry.doc.blurb || entry.doc.content),
      sourceConnectorType: entry.doc.sourceConnectorType,
      sourceType:
        entry.doc.sourceType === "web" ? undefined : entry.doc.sourceType,
      title: entry.doc.title || entry.doc.link || `Source ${entry.number}`,
      updatedAt: entry.doc.updatedAt,
      url: entry.doc.link || undefined,
    });
  }

  const nextNumberStart =
    kbEntries.length > 0
      ? Math.max(...kbEntries.map((entry) => entry.number)) + 1
      : 1;
  let nextNumber = nextNumberStart;
  for (const source of webSources) {
    if (source.type === "api") {
      sources.push({
        key: `web-api:${source.name}:${nextNumber}`,
        kind: "api",
        metadataLabel: getSourceMetadataLabel({ kind: "api" }),
        snippet: undefined,
        title: source.name,
      });
      nextNumber += 1;
      continue;
    }

    if (usedUrls.has(source.url)) {
      continue;
    }
    usedUrls.add(source.url);
    const details = webSourceDetails.get(source.url);
    const title = getWebSourceDisplayTitle(
      source.url,
      details?.title ?? source.title
    );
    sources.push({
      ageLabel: details?.ageLabel,
      key: `web-url:${source.url}:${nextNumber}`,
      kind: "web",
      metadataLabel: getSourceMetadataLabel({ kind: "web", url: source.url }),
      snippet: truncateSourceSnippet(details?.snippet ?? ""),
      title,
      updatedAt: details?.publishedAt,
      url: source.url,
    });
    nextNumber += 1;
  }

  return sources;
}

const PurePreviewMessage = ({
  chatId,
  message,
  messageReactions,
  reactionsUserId,
  isLoading,
  setMessages: _setMessages,
  regenerate: _regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  onEdit,
  onOpenSourcesSidebar,
  editingMessage,
  onCancelEdit,
  onSubmitEdit,
  onOpenThread,
  threadReplyCount = 0,
  threadSummary,
  isMultiplayerRoom = false,
  channelTopicCard = false,
  channelThreadTagCatalog = [],
  channelTopicInbox = false,
  channelMainFlat = false,
  channelThreadPane = false,
  highlightMessageId = null,
  openThreadRootMessageId = null,
  viewThreadRootMessageId = null,
  roomGroupContinuation = false,
}: {
  chatId: string;
  isMultiplayerRoom?: boolean;
  channelTopicCard?: boolean;
  channelThreadTagCatalog?: ThreadTag[];
  /** Mail-style list preview instead of full message body on channel main. */
  channelTopicInbox?: boolean;
  /** Channel main timeline — same row layout as the thread pane (not topic cards). */
  channelMainFlat?: boolean;
  channelThreadPane?: boolean;
  highlightMessageId?: string | null;
  openThreadRootMessageId?: string | null;
  viewThreadRootMessageId?: string | null;
  roomGroupContinuation?: boolean;
  message: ChatMessage;
  messageReactions: MessageReaction[];
  reactionsUserId: string | undefined;
  isLoading: boolean;
  setMessages: ChatSetMessages;
  regenerate: ChatHelpers["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  onEdit?: (message: ChatMessage) => void;
  onOpenSourcesSidebar?: (sources: BottomSource[]) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: (message: ChatMessage, text: string) => void;
  onOpenThread?: () => void;
  threadReplyCount?: number;
  threadSummary?: ThreadSummary;
}) => {
  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();
  const { artifact } = useArtifact();
  const sessionUser = useSessionUser();
  const { profile: viewerProfile } = useProfileOnboardingStatus();

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const authorAuthUserId = message.metadata?.authorAuthUserId;
  const isPeerUserMessage =
    isUser &&
    isMultiplayerRoom &&
    typeof authorAuthUserId === "string" &&
    authorAuthUserId.length > 0 &&
    authorAuthUserId !== sessionUser?.id;
  const isOwnUserMessage = isUser && !isPeerUserMessage;
  const isRoomUserMessage = isMultiplayerRoom && isUser;
  const isRoomPeerUserMessage = isRoomUserMessage && isPeerUserMessage;
  const isEditing = isOwnUserMessage && editingMessage?.id === message.id;
  const channelFlatLayout = channelThreadPane || channelMainFlat;
  const useChannelTopicShell =
    channelTopicCard && !isEditing && !channelTopicInbox;
  const useChannelTopicInbox =
    channelTopicCard && channelTopicInbox && !isEditing;
  const useFloatingChannelActions =
    channelFlatLayout && !useChannelTopicShell && !isEditing && !isReadonly;
  const messageParts = message.parts ?? [];
  const renderedWebSources = getRenderedWebSources(messageParts);
  const webSourceDetails = extractWebSourceDetails(messageParts);
  const hasAnswerText = hasAssistantAnswerText(messageParts, isLoading);
  const messageCitations = collectCitationsFromMessageParts(message.parts);
  const bottomSources = buildBottomSources({
    kbCitations: messageCitations,
    webSourceDetails,
    webSources: renderedWebSources,
  });
  const topBadgeSources = bottomSources.slice(0, 3);
  const showSourcesControl =
    isAssistant && !isLoading && hasAnswerText && bottomSources.length > 0;
  const responderSlug =
    message.metadata?.agentSlug ?? DEFAULT_COMPOSER_ASSISTANT_SLUG;
  const connectCtas = isAssistant ? (message.metadata?.connectCtas ?? []) : [];

  const attachments = attachmentsFromMessage.length > 0 && (
    <div
      className={cn(
        "flex flex-row gap-2",
        isRoomPeerUserMessage || !isOwnUserMessage
          ? "justify-start"
          : "justify-end"
      )}
      data-testid={"message-attachments"}
    >
      {attachmentsFromMessage.map((attachment) => (
        <PreviewAttachment
          attachment={{
            contentType: attachment.mediaType,
            name: attachment.filename ?? "file",
            url: attachment.url,
          }}
          key={attachment.url}
        />
      ))}
    </div>
  );

  const activityPanel = isAssistant ? (
    <AssistantInlineStream
      artifactKind={
        artifact.kind === "code" || artifact.kind === "sheet"
          ? artifact.kind
          : "text"
      }
      artifactTitle={artifact.title}
      assistantMessageId={message.id}
      isMessageStreaming={isLoading}
      isReadonly={isReadonly}
      messageCitations={messageCitations}
      messageParts={messageParts}
    />
  ) : null;

  const userAnswerParts = isAssistant
    ? null
    : message.parts?.map((part, index) => {
        const { type } = part;
        const key = `message-${message.id}-part-${index}`;

        if (type !== "text") {
          return null;
        }

        const text = sanitizeText(part.text);
        if (!text.trim()) {
          return null;
        }

        const selection = message.metadata?.documentSelection;
        const composerText = message.metadata?.composerText?.trim();
        const wireUserText = text;
        const visibleUserText =
          selection && composerText
            ? composerText
            : isMultiplayerRoom && composerText
              ? composerText
              : wireUserText;

        return (
          <MessageContent
            className={cn(
              "wrap-break-word text-left text-foreground text-base [&_li]:text-base [&_ol]:text-base [&_p]:text-base [&_ul]:text-base",
              channelTopicCard || channelFlatLayout
                ? "bg-transparent p-0 shadow-none"
                : isOwnUserMessage && !isMultiplayerRoom
                  ? USER_OWN_MESSAGE_BUBBLE_CLASS
                  : USER_PEER_MESSAGE_BUBBLE_CLASS
            )}
            data-testid="message-content"
            key={key}
          >
            {selection ? (
              <div className="mb-2 flex flex-col gap-2">
                <DocumentSelectionChip
                  compact
                  text={selection.text}
                  title={selection.title}
                />
                <UserMessageConnectorBody
                  metadata={message.metadata}
                  text={wireUserText}
                  visibleText={visibleUserText}
                />
              </div>
            ) : (
              <UserMessageConnectorBody
                metadata={message.metadata}
                text={wireUserText}
                visibleText={visibleUserText}
              />
            )}
          </MessageContent>
        );
      });

  const threadReplyControl =
    onOpenThread && !channelThreadPane ? (
      <MessageThreadReply
        channelCard={useChannelTopicShell || useChannelTopicInbox}
        embeddedInRow={useChannelTopicInbox}
        onOpenThread={onOpenThread}
        replyCount={threadReplyCount}
        summary={threadSummary}
      />
    ) : null;

  const reactionChips = (
    <MessageReactionChips
      chatId={chatId}
      currentUserId={reactionsUserId}
      messageId={message.id}
      reactions={messageReactions}
    />
  );

  const inlineMessageActions =
    !isReadonly && !isEditing && !useChannelTopicShell ? (
      <MessageActions
        chatId={chatId}
        currentUserId={reactionsUserId}
        floatingToolbar={useFloatingChannelActions}
        isLoading={isLoading}
        key={`action-${message.id}`}
        message={message}
        onEdit={onEdit && isOwnUserMessage ? () => onEdit(message) : undefined}
        onOpenThread={
          useFloatingChannelActions && !channelThreadPane
            ? onOpenThread
            : undefined
        }
        reactions={messageReactions}
      />
    ) : null;

  const footerMessageActions = useFloatingChannelActions
    ? null
    : inlineMessageActions;

  const floatingMessageActions = useFloatingChannelActions
    ? inlineMessageActions
    : null;

  const chatAuthorDisplayName = resolveRoomMessageAuthorDisplayName({
    isOwnMessage: isOwnUserMessage,
    metadataAuthorDisplayName: message.metadata?.authorDisplayName,
    metadataAuthorEmail: message.metadata?.authorEmail,
    viewerEmail: sessionUser?.email,
    viewerFullName: sessionUser?.name,
    viewerPreferredName: viewerProfile?.preferredName,
  });

  const useRoomMemberLayout =
    !useChannelTopicShell &&
    !useChannelTopicInbox &&
    !isEditing &&
    isUser &&
    (channelFlatLayout
      ? Boolean(chatAuthorDisplayName)
      : isRoomPeerUserMessage && Boolean(chatAuthorDisplayName));

  const assistantMessageBody = (
    <>
      {activityPanel}
      {isAssistant &&
      message.metadata?.pendingToolApproval &&
      !isReadonly &&
      !messageHasInlineToolApproval(message) ? (
        <WorkflowRunActions message={message} />
      ) : null}
      {connectCtas.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {connectCtas.map((cta) => {
            const provider = resolveConnectorProviderIcon(cta.integrationKey);
            if (!provider) {
              return null;
            }
            return (
              <ConnectorConnectButton
                href={cta.connectUrl}
                key={`${cta.integrationKey}-${cta.connectUrl}`}
                label={cta.connectLabel}
                provider={provider}
              />
            );
          })}
        </div>
      ) : null}
      {useChannelTopicShell ? null : reactionChips}
      {useChannelTopicShell ? null : (
        <MessageThreadFooter
          actions={footerMessageActions}
          align="start"
          threadReplyControl={threadReplyControl}
        >
          {showSourcesControl ? (
            <button
              className={cn(
                activityChipClassName,
                "gap-1.5 transition-colors hover:bg-muted"
              )}
              onClick={() => onOpenSourcesSidebar?.(bottomSources)}
              type="button"
            >
              {topBadgeSources.length > 0 ? (
                <span className="flex items-center gap-1">
                  {topBadgeSources.map((source) => (
                    <SourceBadgeIcon
                      className="size-3 shrink-0"
                      imageClassName="size-3"
                      key={source.key}
                      source={source}
                    />
                  ))}
                </span>
              ) : null}
              <span>References</span>
            </button>
          ) : null}
        </MessageThreadFooter>
      )}
      {useChannelTopicShell && showSourcesControl ? (
        <button
          className={cn(
            activityChipClassName,
            "mt-2 gap-1.5 transition-colors hover:bg-muted"
          )}
          onClick={() => onOpenSourcesSidebar?.(bottomSources)}
          type="button"
        >
          {topBadgeSources.length > 0 ? (
            <span className="flex items-center gap-1">
              {topBadgeSources.map((source) => (
                <SourceBadgeIcon
                  className="size-3 shrink-0"
                  imageClassName="size-3"
                  key={source.key}
                  source={source}
                />
              ))}
            </span>
          ) : null}
          <span>References</span>
        </button>
      ) : null}
    </>
  );

  const userMessageBody = (
    <>
      {attachments}
      {userAnswerParts}
    </>
  );

  const content = (
    <>
      {useRoomMemberLayout || useChannelTopicShell ? null : attachments}
      {isAssistant ? (
        useChannelTopicShell ? (
          assistantMessageBody
        ) : (
          <AssistantMessageLayout
            continuation={roomGroupContinuation}
            createdAt={message.metadata?.createdAt}
            displayName={message.metadata?.agentName}
            iconColor={message.metadata?.agentIconColor}
            responderSlug={responderSlug}
          >
            {assistantMessageBody}
          </AssistantMessageLayout>
        )
      ) : isEditing && channelFlatLayout && isUser ? (
        <RoomMemberMessageLayout
          align="start"
          continuation={false}
          createdAt={message.metadata?.createdAt}
          displayName={chatAuthorDisplayName}
          email={
            isOwnUserMessage
              ? sessionUser?.email
              : message.metadata?.authorEmail
          }
          image={
            isOwnUserMessage
              ? sessionUser?.image
              : message.metadata?.authorImage
          }
          userId={
            isOwnUserMessage
              ? sessionUser?.id
              : typeof authorAuthUserId === "string" &&
                  authorAuthUserId.length > 0
                ? authorAuthUserId
                : undefined
          }
        >
          <UserMessageEditor
            initialText={
              message.parts
                ?.filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n")
                .trim() ?? ""
            }
            onCancel={() => onCancelEdit?.()}
            onSend={(text) => onSubmitEdit?.(message, text)}
            variant="flat"
          />
        </RoomMemberMessageLayout>
      ) : isEditing ? (
        <>
          <MessageTimestamp
            align="end"
            createdAt={message.metadata?.createdAt}
            editedAt={message.metadata?.editedAt}
          />
          <UserMessageEditor
            initialText={
              message.parts
                ?.filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n")
                .trim() ?? ""
            }
            onCancel={() => onCancelEdit?.()}
            onSend={(text) => onSubmitEdit?.(message, text)}
          />
        </>
      ) : useChannelTopicShell && isUser ? (
        userMessageBody
      ) : useRoomMemberLayout ? (
        <RoomMemberMessageLayout
          align="start"
          continuation={roomGroupContinuation}
          createdAt={message.metadata?.createdAt}
          displayName={chatAuthorDisplayName}
          email={
            isOwnUserMessage && channelFlatLayout
              ? sessionUser?.email
              : message.metadata?.authorEmail
          }
          image={
            isOwnUserMessage && channelFlatLayout
              ? sessionUser?.image
              : message.metadata?.authorImage
          }
          userId={
            isOwnUserMessage && channelFlatLayout
              ? sessionUser?.id
              : typeof authorAuthUserId === "string" &&
                  authorAuthUserId.length > 0
                ? authorAuthUserId
                : undefined
          }
        >
          <div className="flex max-w-full flex-col items-start gap-1.5">
            {attachments}
            {userAnswerParts}
            {reactionChips}
            <MessageThreadFooter
              actions={footerMessageActions}
              actionsAfterThread
              align="start"
              className="mt-0"
              threadReplyControl={channelThreadPane ? null : threadReplyControl}
            />
          </div>
        </RoomMemberMessageLayout>
      ) : (
        <>
          {roomGroupContinuation ? null : (
            <MessageTimestamp
              align="end"
              createdAt={message.metadata?.createdAt}
              editedAt={message.metadata?.editedAt}
            />
          )}
          {userAnswerParts}
          {reactionChips}
          <MessageThreadFooter
            actions={footerMessageActions}
            actionsAfterThread={!isOwnUserMessage}
            align={isOwnUserMessage ? "end" : "start"}
            threadReplyControl={threadReplyControl}
          />
        </>
      )}
    </>
  );

  const isHighlighted = highlightMessageId === message.id;
  const isOpenThreadRoot =
    Boolean(openThreadRootMessageId) &&
    openThreadRootMessageId === message.id &&
    (channelTopicCard || channelTopicInbox);

  const isKimiroResponder = responderSlug === DEFAULT_COMPOSER_ASSISTANT_SLUG;

  const topicDisplayName = isAssistant
    ? (message.metadata?.agentName?.trim() ?? responderSlug)
    : chatAuthorDisplayName;

  const topicAvatarClassName = useChannelTopicInbox
    ? channelTopicInboxAvatarClassName
    : channelTopicAvatarClassName;

  const topicAvatar = isAssistant ? (
    isKimiroResponder ? (
      <KimiroIconTile className={topicAvatarClassName} size="xs" />
    ) : (
      <AssistantIconTile
        className={topicAvatarClassName}
        iconColor={message.metadata?.agentIconColor}
        size="xs"
      />
    )
  ) : (
    <UserAvatar
      className={topicAvatarClassName}
      email={
        isOwnUserMessage
          ? (sessionUser?.email ?? message.metadata?.authorEmail)
          : message.metadata?.authorEmail
      }
      image={
        isOwnUserMessage
          ? (sessionUser?.image ?? message.metadata?.authorImage)
          : message.metadata?.authorImage
      }
      name={chatAuthorDisplayName}
      size="xs"
      userId={
        typeof authorAuthUserId === "string" && authorAuthUserId.length > 0
          ? authorAuthUserId
          : sessionUser?.id
      }
    />
  );

  const threadTags = resolveThreadTagsAgainstCatalog(
    readMessageThreadTags(message.metadata),
    channelThreadTagCatalog
  );
  const inboxListDisplay = useChannelTopicInbox
    ? resolveChannelInboxListDisplay(message, threadTags, {
        lastReplyPreview: threadSummary?.lastReplyPreview,
      })
    : null;
  const inboxTagPills =
    inboxListDisplay?.titleFromTagLabel && threadTags.length > 0
      ? threadTags.filter(
          (topic) =>
            topic.label.toLowerCase() !==
            inboxListDisplay.titleFromTagLabel?.toLowerCase()
        )
      : threadTags;

  const topicCardFooterRight =
    (useChannelTopicShell || useChannelTopicInbox) &&
    (useChannelTopicInbox ? inboxTagPills : threadTags).length > 0 ? (
      <ThreadTagPillRow
        tags={useChannelTopicInbox ? inboxTagPills : threadTags}
        variant="card"
      />
    ) : null;

  const wireUserText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n") ?? "";

  const isTitleOnlyChannelThreadRoot =
    channelThreadPane &&
    viewThreadRootMessageId === message.id &&
    isUser &&
    Boolean(message.metadata?.threadTitle?.trim()) &&
    isChannelEmptyRootBodyText(wireUserText);

  if (isTitleOnlyChannelThreadRoot) {
    return null;
  }

  const messageShell = useChannelTopicInbox ? (
    <ChannelTopicMessageRow inboxList>
      <ChannelTopicMessageCard
        createdAt={message.metadata?.createdAt}
        displayName={topicDisplayName}
        footerRight={topicCardFooterRight}
        headerLeading={topicAvatar}
        highlighted={isHighlighted}
        inboxList
        onOpenThread={onOpenThread}
        preview={inboxListDisplay?.preview}
        selected={isOpenThreadRoot}
        threadReply={threadReplyControl}
        title={inboxListDisplay?.title}
      />
    </ChannelTopicMessageRow>
  ) : useChannelTopicShell ? (
    <ChannelTopicMessageRow>
      <ChannelTopicMessageCard
        createdAt={message.metadata?.createdAt}
        displayName={topicDisplayName}
        footerRight={topicCardFooterRight}
        headerLeading={topicAvatar}
        highlighted={isHighlighted}
        selected={isOpenThreadRoot}
        threadReply={threadReplyControl}
      >
        {content}
      </ChannelTopicMessageCard>
    </ChannelTopicMessageRow>
  ) : (
    <div
      className={cn(
        isHighlighted && "relative z-[1]",
        channelFlatLayout || isAssistant || isRoomPeerUserMessage
          ? cn(
              "flex min-w-0 w-full flex-col",
              roomGroupContinuation ? "gap-0.5" : "gap-1 md:gap-2"
            )
          : isEditing
            ? "ml-auto flex w-full max-w-[calc(100%-6rem)] flex-col items-end gap-0.5 md:gap-1"
            : "ml-auto flex max-w-[calc(100%-6rem)] flex-col items-end gap-0.5 sm:max-w-[min(fit-content,58%)] md:gap-1"
      )}
    >
      {content}
    </div>
  );

  return (
    <div
      className={cn(
        "group/message relative w-full rounded-lg",
        (useChannelTopicShell || useChannelTopicInbox) && "max-w-none",
        isHighlighted &&
          !useChannelTopicShell &&
          !isOpenThreadRoot &&
          "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-md before:bg-[#fff9e6] before:content-[''] dark:before:bg-amber-950/35"
      )}
      data-role={message.role}
      data-testid={`message-${message.role}`}
      id={chatMessageDomId(message.id)}
    >
      {floatingMessageActions ? (
        <div
          className={cn(
            "pointer-events-none absolute -top-2 right-0 z-10 flex items-center opacity-0 transition-opacity",
            "group-hover/message:pointer-events-auto group-hover/message:opacity-100",
            "group-focus-within/message:pointer-events-auto group-focus-within/message:opacity-100"
          )}
        >
          {floatingMessageActions}
        </div>
      ) : null}
      {messageShell}
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.message === nextProps.message &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.isMultiplayerRoom === nextProps.isMultiplayerRoom &&
    prevProps.channelTopicCard === nextProps.channelTopicCard &&
    prevProps.channelTopicInbox === nextProps.channelTopicInbox &&
    prevProps.channelMainFlat === nextProps.channelMainFlat &&
    prevProps.channelThreadPane === nextProps.channelThreadPane &&
    prevProps.threadReplyCount === nextProps.threadReplyCount &&
    prevProps.threadSummary === nextProps.threadSummary &&
    prevProps.isReadonly === nextProps.isReadonly &&
    equal(
      reactionsForMessage(prevProps.messageReactions, prevProps.message.id),
      reactionsForMessage(nextProps.messageReactions, nextProps.message.id)
    ) &&
    prevProps.reactionsUserId === nextProps.reactionsUserId &&
    prevProps.editingMessage?.id === nextProps.editingMessage?.id &&
    prevProps.highlightMessageId === nextProps.highlightMessageId &&
    prevProps.openThreadRootMessageId === nextProps.openThreadRootMessageId &&
    prevProps.viewThreadRootMessageId === nextProps.viewThreadRootMessageId &&
    prevProps.roomGroupContinuation === nextProps.roomGroupContinuation &&
    equal(prevProps.channelThreadTagCatalog, nextProps.channelThreadTagCatalog)
);

export const ThinkingMessage = () => (
  <div
    className="group/message w-full"
    data-role="assistant"
    data-testid="message-assistant-loading"
  >
    <AssistantMessageLayout responderSlug={DEFAULT_COMPOSER_ASSISTANT_SLUG}>
      <AssistantInlineStream
        artifactKind="text"
        artifactTitle=""
        isMessageStreaming={true}
        isReadonly={true}
        messageCitations={{}}
        messageParts={[]}
      />
    </AssistantMessageLayout>
  </div>
);
