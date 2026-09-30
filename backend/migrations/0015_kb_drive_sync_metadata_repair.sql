ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" timestamp;

ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" timestamp;

UPDATE "TeamKbItem"
SET
  "sourceUpdatedAt" = COALESCE("sourceUpdatedAt", "updatedAt"),
  "lastSyncedAt" = COALESCE("lastSyncedAt", "updatedAt")
WHERE "sourceType" = 'drive';
