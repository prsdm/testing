ALTER TABLE "TenantSearchSettings"
  ADD COLUMN IF NOT EXISTS "maxIndexedContentSizeMb" bigint DEFAULT 10 NOT NULL;

ALTER TABLE "TenantSearchSettings"
  DROP COLUMN IF EXISTS "driveIndexMaxFiles";
