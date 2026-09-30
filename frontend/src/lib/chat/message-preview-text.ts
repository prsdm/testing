import {
  normalizeThreadTitle,
  type ThreadTag,
} from "@/shared/chat/thread-tags";
import type { ChatMessage } from "@/shared/types";
import { sanitizeText } from "@/shared/utils";

function stripMarkdownLite(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function messagePlainText(message: ChatMessage): string {
  const composer = message.metadata?.composerText?.trim();
  if (composer) {
    return composer;
  }

  const chunks: string[] = [];
  for (const part of message.parts ?? []) {
    if (part.type === "text" && part.text) {
      chunks.push(sanitizeText(part.text));
    }
  }
  return chunks.join("\n").trim();
}

const SUBJECT_MAX = 96;
const SNIPPET_MAX = 220;

/** Placeholder body for title-only channel thread roots (not shown in UI). */
export const CHANNEL_THREAD_EMPTY_ROOT_TEXT = "\u200b";

export function isChannelEmptyRootBodyText(text: string): boolean {
  return stripMarkdownLite(text.replace(/\u200b/g, "")).length === 0;
}

export function isTitleOnlyChannelRootMessage(message: ChatMessage): boolean {
  if (!message.metadata?.threadTitle?.trim()) {
    return false;
  }
  return isChannelEmptyRootBodyText(messagePlainText(message));
}

/** Inbox list subject + muted preview (first line / remainder). */
export function getMessagePreviewLines(message: ChatMessage): {
  subject: string;
  snippet: string;
} {
  const multiline = messagePlainText(message);
  const lines = multiline
    .split(/\n/)
    .map((line) => stripMarkdownLite(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      subject: message.role === "assistant" ? "Kimiro" : "Message",
      snippet: "",
    };
  }

  if (lines.length > 1) {
    return {
      subject: truncate(lines[0] ?? "", SUBJECT_MAX),
      snippet: truncate(lines.slice(1).join(" "), SNIPPET_MAX),
    };
  }

  const raw = lines[0] ?? "";

  if (raw.length <= SUBJECT_MAX) {
    return { subject: raw, snippet: "" };
  }

  const breakAt = raw.lastIndexOf(" ", SUBJECT_MAX);
  const cut = breakAt > 32 ? breakAt : SUBJECT_MAX;
  return {
    subject: raw.slice(0, cut).trim(),
    snippet: truncate(raw.slice(cut).trim(), SNIPPET_MAX),
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function joinPreviewLines(preview: {
  subject: string;
  snippet: string;
}): string {
  return [preview.subject, preview.snippet].filter(Boolean).join(" ").trim();
}

/** Plain-text preview for inbox list snippets. */
export function getMessageBodyPreviewText(message: ChatMessage): string {
  return joinPreviewLines(getMessagePreviewLines(message));
}

/** Inbox row title + body preview (mail-style). */
export function resolveChannelInboxListDisplay(
  message: ChatMessage,
  threadTags: ThreadTag[],
  options?: { lastReplyPreview?: string }
): { preview: string; title: string; titleFromTagLabel: string | null } {
  const preview = getMessagePreviewLines(message);
  const bodyPreview = joinPreviewLines(preview);

  const explicitTitle = message.metadata?.threadTitle
    ? normalizeThreadTitle(message.metadata.threadTitle)
    : null;
  if (explicitTitle) {
    let listPreview = "";
    if (!isTitleOnlyChannelRootMessage(message)) {
      listPreview = isChannelEmptyRootBodyText(bodyPreview) ? "" : bodyPreview;
    }
    if (!listPreview && options?.lastReplyPreview?.trim()) {
      listPreview = options.lastReplyPreview.trim();
    }
    return {
      preview: listPreview,
      title: explicitTitle,
      titleFromTagLabel: null,
    };
  }

  const topicTitle = threadTags[0]?.label ?? null;
  if (topicTitle) {
    return {
      preview: bodyPreview,
      title: topicTitle,
      titleFromTagLabel: topicTitle,
    };
  }

  return {
    preview: preview.snippet,
    title: preview.subject,
    titleFromTagLabel: null,
  };
}
