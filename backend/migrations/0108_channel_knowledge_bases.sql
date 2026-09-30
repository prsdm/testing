ALTER TABLE "KnowledgeBase"
  ADD COLUMN IF NOT EXISTS "channelChatId" uuid;

DO $$ BEGIN
 ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_channelChatId_Chat_id_fk" FOREIGN KEY ("channelChatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeBase_channel_chat_unique" ON "KnowledgeBase" ("channelChatId");
