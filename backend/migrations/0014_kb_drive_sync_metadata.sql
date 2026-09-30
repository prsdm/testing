ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" timestamp;

ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" timestamp;

-- Backfill sync metadata for existing drive-backed items.
UPDATE "TeamKbItem"
SET
  "sourceUpdatedAt" = COALESCE("sourceUpdatedAt", "updatedAt"),
  "lastSyncedAt" = COALESCE("lastSyncedAt", "updatedAt")
WHERE "sourceType" = 'drive';
