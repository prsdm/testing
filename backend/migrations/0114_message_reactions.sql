CREATE TABLE IF NOT EXISTS "MessageReaction" (
  "chatId" uuid NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "messageId" uuid NOT NULL REFERENCES "Message_v2"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "emoji" varchar(32) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("messageId", "userId", "emoji")
);

CREATE INDEX IF NOT EXISTS "MessageReaction_chat_idx" ON "MessageReaction" ("chatId");
