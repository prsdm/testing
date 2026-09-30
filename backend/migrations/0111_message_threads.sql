ALTER TABLE "Message_v2"
  ADD COLUMN IF NOT EXISTS "threadRootMessageId" uuid;

CREATE INDEX IF NOT EXISTS "Message_v2_chat_thread_root_idx"
  ON "Message_v2" ("chatId", "threadRootMessageId");
