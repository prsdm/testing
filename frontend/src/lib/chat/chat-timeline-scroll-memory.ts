export const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 120;

export type ChatTimelineScrollSnapshot = {
  scrollTop: number;
  atBottom: boolean;
};

const scrollByKey = new Map<string, ChatTimelineScrollSnapshot>();
const SESSION_STORAGE_PREFIX = "kimiro.chatTimelineScroll:";

export function mainTimelineScrollMemoryKey(chatId: string) {
  return `${chatId}:main`;
}

export function threadChannelPaneScrollMemoryKey(chatId: string) {
  return `${chatId}:thread-channel`;
}

export function roomThreadScrollMemoryKey(
  chatId: string,
  threadRootMessageId: string
) {
  return `${chatId}:thread:${threadRootMessageId}`;
}

export function chatScrollSnapshotFromContainer(
  container: HTMLElement
): ChatTimelineScrollSnapshot {
  const scrollTop = container.scrollTop;
  if (container.clientHeight <= 1) {
    return { atBottom: false, scrollTop };
  }
  const distanceFromBottom =
    container.scrollHeight - scrollTop - container.clientHeight;
  const atBottom =
    container.scrollHeight <= container.clientHeight + 1 ||
    distanceFromBottom <= CHAT_SCROLL_BOTTOM_THRESHOLD_PX;
  return { atBottom, scrollTop };
}

function parseStoredSnapshot(raw: string): ChatTimelineScrollSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return { atBottom: false, scrollTop: parsed };
    }
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const scrollTop = record.scrollTop;
    if (typeof scrollTop !== "number" || !Number.isFinite(scrollTop)) {
      return null;
    }
    return {
      atBottom: record.atBottom === true,
      scrollTop: Math.max(0, scrollTop),
    };
  } catch {
    return null;
  }
}

function readSessionSnapshot(
  key: string
): ChatTimelineScrollSnapshot | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }
  const raw = sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${key}`);
  if (!raw) {
    return undefined;
  }
  const snapshot = parseStoredSnapshot(raw);
  return snapshot ?? undefined;
}

function writeSessionSnapshot(
  key: string,
  snapshot: ChatTimelineScrollSnapshot
) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(
    `${SESSION_STORAGE_PREFIX}${key}`,
    JSON.stringify(snapshot)
  );
}

export function rememberChatTimelineScroll(
  key: string,
  snapshot: ChatTimelineScrollSnapshot
) {
  if (!Number.isFinite(snapshot.scrollTop) || snapshot.scrollTop < 0) {
    return;
  }
  const normalized: ChatTimelineScrollSnapshot = {
    atBottom: snapshot.atBottom,
    scrollTop: snapshot.scrollTop,
  };
  scrollByKey.set(key, normalized);
  writeSessionSnapshot(key, normalized);
}

export function recallChatTimelineScroll(
  key: string
): ChatTimelineScrollSnapshot | undefined {
  const cached = scrollByKey.get(key);
  if (cached) {
    return cached;
  }
  const fromSession = readSessionSnapshot(key);
  if (fromSession) {
    scrollByKey.set(key, fromSession);
  }
  return fromSession;
}

export function forgetChatTimelineScroll(key: string) {
  scrollByKey.delete(key);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${key}`);
  }
}

export function forgetChatTimelineScrollsForChat(chatId: string) {
  for (const key of scrollByKey.keys()) {
    if (key.startsWith(`${chatId}:`)) {
      forgetChatTimelineScroll(key);
    }
  }
}
