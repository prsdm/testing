ALTER TABLE "Chat"
ADD COLUMN IF NOT EXISTS "contextSummary" text,
ADD COLUMN IF NOT EXISTS "contextSummaryThroughMessageId" uuid REFERENCES "Message_v2"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "contextSummaryUpdatedAt" timestamp;
