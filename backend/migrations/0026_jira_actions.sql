CREATE TABLE IF NOT EXISTS "TenantJiraActionsSettings" (
  "tenantId" uuid PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "jiraActionsEnabled" boolean NOT NULL DEFAULT false,
  "credentialMode" varchar(16) NOT NULL DEFAULT 'managed',
  "siteUrl" varchar(512),
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
