import {
  getMessageSectionAnchor,
  shouldShowMessageSectionTime,
} from "@/lib/chat/message-section-time";
import type { ChatMessage } from "@/shared/types";
import { getTextFromMessage } from "@/shared/utils";

function messageHasMention(text: string): boolean {
  return /\B@[\w.-]+/.test(text);
}

/** Slack-style: same author within this window groups into one block. */
export const ROOM_MESSAGE_GROUP_GAP_MS = 5 * 60 * 1000;

export function roomMessageGroupKey(
  message: ChatMessage,
  viewerUserId: string | undefined
): string | null {
  if (message.role === "assistant") {
    const slug = message.metadata?.agentSlug ?? "assistant";
    return `assistant:${slug}`;
  }
  if (message.role === "user") {
    const authorId = message.metadata?.authorAuthUserId;
    if (typeof authorId === "string" && authorId.length > 0) {
      return authorId === viewerUserId ? "user:self" : `user:${authorId}`;
    }
    return "user:self";
  }
  return null;
}

export function shouldContinueRoomMessageGroup(
  previous: ChatMessage,
  current: ChatMessage,
  viewerUserId: string | undefined,
  options?: { previousThreadReplyCount?: number }
): boolean {
  const previousKey = roomMessageGroupKey(previous, viewerUserId);
  const currentKey = roomMessageGroupKey(current, viewerUserId);
  if (!previousKey || !currentKey || previousKey !== currentKey) {
    return false;
  }

  if ((options?.previousThreadReplyCount ?? 0) > 0) {
    return false;
  }

  const previousText = getTextFromMessage(previous);
  const currentText = getTextFromMessage(current);
  if (messageHasMention(previousText) || messageHasMention(currentText)) {
    return false;
  }

  const previousAt = getMessageSectionAnchor(previous);
  const currentAt = getMessageSectionAnchor(current);
  if (!previousAt || !currentAt) {
    return false;
  }

  if (shouldShowMessageSectionTime(currentAt, previousAt)) {
    return false;
  }

  const previousMs = new Date(previousAt).getTime();
  const currentMs = new Date(currentAt).getTime();
  if (Number.isNaN(previousMs) || Number.isNaN(currentMs)) {
    return false;
  }

  return currentMs - previousMs <= ROOM_MESSAGE_GROUP_GAP_MS;
}
