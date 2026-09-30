ALTER TABLE "TenantConfluenceActionsSettings"
  ADD COLUMN IF NOT EXISTS "oauthClientId" varchar(512);

ALTER TABLE "TenantConfluenceActionsSettings"
  ADD COLUMN IF NOT EXISTS "oauthClientSecretEncrypted" text;
