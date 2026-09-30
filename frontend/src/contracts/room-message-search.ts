export type RoomMessageSearchHit = {
  messageId: string;
  threadRootMessageId: string | null;
  role: string;
  createdAt: string;
  snippet: string;
  authorDisplayName: string | null;
};

export type RoomMessageSearchResponse = {
  query: string;
  hits: RoomMessageSearchHit[];
};
