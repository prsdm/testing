DO $$
BEGIN
  ALTER TYPE kb_source_type ADD VALUE IF NOT EXISTS 'sharepoint';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TenantSharePointActionsSettings" (
  "tenantId" uuid PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "sharePointActionsEnabled" boolean NOT NULL DEFAULT false,
  "credentialMode" varchar(16) NOT NULL DEFAULT 'managed',
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "allowRead" boolean NOT NULL DEFAULT true,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
