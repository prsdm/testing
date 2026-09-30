CREATE TABLE IF NOT EXISTS "TenantSlackActionsSettings" (
  "tenantId" uuid PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "slackActionsEnabled" boolean NOT NULL DEFAULT false,
  "credentialMode" varchar(16) NOT NULL DEFAULT 'managed',
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
