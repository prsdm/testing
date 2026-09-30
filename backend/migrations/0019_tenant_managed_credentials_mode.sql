ALTER TABLE "TenantDriveActionsSettings"
  ADD COLUMN IF NOT EXISTS "credentialMode" varchar(16) DEFAULT 'managed' NOT NULL;

UPDATE "TenantDriveActionsSettings"
SET "credentialMode" = 'own'
WHERE "oauthClientId" IS NOT NULL AND length(trim("oauthClientId")) > 0;

ALTER TABLE "TenantConfluenceActionsSettings"
  ADD COLUMN IF NOT EXISTS "credentialMode" varchar(16) DEFAULT 'managed' NOT NULL;

UPDATE "TenantConfluenceActionsSettings"
SET "credentialMode" = 'own'
WHERE "oauthClientId" IS NOT NULL AND length(trim("oauthClientId")) > 0;
