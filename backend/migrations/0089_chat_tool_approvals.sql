ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "toolApprovals" jsonb DEFAULT '{}'::jsonb;
