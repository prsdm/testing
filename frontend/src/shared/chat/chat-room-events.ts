export type ChatRoomTypist = {
  userId: string;
  displayName: string;
  threadRootMessageId: string | null;
};

export type ChatRoomRealtimeEvent =
  | { type: "connected"; chatId: string }
  | {
      type: "messages.changed";
      chatId: string;
      threadRootMessageId?: string | null;
    }
  | {
      type: "typing.changed";
      chatId: string;
      typists: ChatRoomTypist[];
    }
  | {
      type: "reactions.changed";
      chatId: string;
      messageId: string;
    };
