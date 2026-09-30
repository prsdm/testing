ALTER TABLE "ChatParticipant"
  ADD COLUMN IF NOT EXISTS "lastReadAt" timestamp;
