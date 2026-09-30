DO $$ BEGIN
 CREATE TYPE "chat_kind" AS ENUM('personal', 'channel');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "chat_participant_role" AS ENUM('owner', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "kind" "chat_kind" NOT NULL DEFAULT 'personal';

CREATE TABLE IF NOT EXISTS "ChatParticipant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chatId" uuid NOT NULL,
  "userId" text NOT NULL,
  "role" "chat_participant_role" NOT NULL DEFAULT 'member',
  "addedByUserId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ChatParticipant_chat_user_unique" ON "ChatParticipant" ("chatId", "userId");
CREATE INDEX IF NOT EXISTS "ChatParticipant_chat_idx" ON "ChatParticipant" ("chatId");
CREATE INDEX IF NOT EXISTS "ChatParticipant_user_idx" ON "ChatParticipant" ("userId");
