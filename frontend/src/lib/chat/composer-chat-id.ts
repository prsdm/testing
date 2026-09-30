/** Sticky composer chat id when the URL has no /chat/:id (home + in-flight runs). */
let composerChatId: string | null = null;
const listeners = new Set<() => void>();

export function setComposerChatId(id: string | null) {
  if (composerChatId === id) {
    return;
  }
  composerChatId = id;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeComposerChatId(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getComposerChatIdSnapshot() {
  return composerChatId;
}
