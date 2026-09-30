import { getMessageBodyPreviewText } from "@/lib/chat/message-preview-text";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import type { ChatMessage } from "@/shared/types";

export type ThreadParticipantFace =
  | {
      kind: "user";
      name: string;
      email?: string | null;
      image?: string | null;
      userId?: string | null;
    }
  | { kind: "kimiro" };

export type ThreadSummary = {
  replyCount: number;
  lastReplyAt?: string;
  /** Snippet for inbox list when the root is title-only. */
  lastReplyPreview?: string;
  participants: ThreadParticipantFace[];
};

function participantKey(message: ChatMessage): string {
  if (message.role === "assistant") {
    return (
      message.metadata?.agentSlug?.trim() ?? DEFAULT_COMPOSER_ASSISTANT_SLUG
    );
  }
  const authorId = message.metadata?.authorAuthUserId?.trim();
  if (authorId) {
    return `user:${authorId}`;
  }
  return `user:${message.id}`;
}

function toParticipantFace(message: ChatMessage): ThreadParticipantFace {
  if (message.role === "assistant") {
    return { kind: "kimiro" };
  }
  return {
    kind: "user",
    email: message.metadata?.authorEmail,
    image: message.metadata?.authorImage,
    name:
      message.metadata?.authorDisplayName?.trim() ||
      message.metadata?.authorEmail?.trim() ||
      "Member",
    userId: message.metadata?.authorAuthUserId,
  };
}

function messageCreatedAtMs(message: ChatMessage): number {
  const raw = message.metadata?.createdAt;
  if (!raw) {
    return 0;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Merge live chat state with thread-only rows from the messages API. */
export function mergeMessagesForThreadSummaries(
  liveMessages: ChatMessage[],
  threadReplyMessages: ChatMessage[]
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of threadReplyMessages) {
    byId.set(message.id, message);
  }
  for (const message of liveMessages) {
    byId.set(message.id, message);
  }
  return [...byId.values()];
}

export function buildThreadSummaries(
  allMessages: ChatMessage[],
  threadReplyCounts: Record<string, number>
): Record<string, ThreadSummary> {
  const repliesByRoot = new Map<string, ChatMessage[]>();

  for (const message of allMessages) {
    const rootId = message.threadRootMessageId;
    if (!rootId) {
      continue;
    }
    const bucket = repliesByRoot.get(rootId) ?? [];
    bucket.push(message);
    repliesByRoot.set(rootId, bucket);
  }

  const rootIds = new Set<string>([
    ...Object.keys(threadReplyCounts),
    ...repliesByRoot.keys(),
  ]);

  const summaries: Record<string, ThreadSummary> = {};

  for (const rootId of rootIds) {
    const replies = repliesByRoot.get(rootId) ?? [];
    const replyCount = threadReplyCounts[rootId] ?? replies.length;
    if (replyCount <= 0) {
      continue;
    }

    const sortedReplies = [...replies].sort(
      (left, right) => messageCreatedAtMs(left) - messageCreatedAtMs(right)
    );
    const lastReply = sortedReplies.at(-1);
    const lastReplyAt = lastReply?.metadata?.createdAt;
    const lastReplyPreview = lastReply
      ? getMessageBodyPreviewText(lastReply)
      : undefined;

    const seen = new Set<string>();
    const participants: ThreadParticipantFace[] = [];
    for (const reply of [...sortedReplies].reverse()) {
      const key = participantKey(reply);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      participants.push(toParticipantFace(reply));
      if (participants.length >= 3) {
        break;
      }
    }

    summaries[rootId] = {
      lastReplyAt,
      lastReplyPreview,
      participants,
      replyCount,
    };
  }

  return summaries;
}
