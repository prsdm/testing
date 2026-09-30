export const CHAT_HOME = "/";

export function chatConversationPath(chatId: string) {
  return `/c/${chatId}`;
}

export function extractChatIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isChatConversationPath(pathname: string): boolean {
  return /^\/c\/[^/]+/.test(pathname);
}

export function isChatHomePath(pathname: string): boolean {
  return pathname === CHAT_HOME;
}

export function isChatAreaPath(pathname: string): boolean {
  return isChatHomePath(pathname) || isChatConversationPath(pathname);
}
