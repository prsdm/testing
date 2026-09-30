export type { RoomMessageSearchResponse } from "@/contracts/room-message-search";

export function roomMessageSearchApiUrl(chatId: string, query: string) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const params = new URLSearchParams({ q: query });
  return `${basePath}/api/chat/${chatId}/messages/search?${params.toString()}`;
}

export function roomMessageSearchSwrKey(chatId: string, query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return null;
  }
  return roomMessageSearchApiUrl(chatId, trimmed);
}
