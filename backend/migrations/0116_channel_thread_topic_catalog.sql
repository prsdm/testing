ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "threadTopicCatalog" jsonb;
