CREATE TABLE IF NOT EXISTS "TenantSlackBotSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "dmsEnabled" boolean NOT NULL DEFAULT true,
  "deliverablesEnabled" boolean NOT NULL DEFAULT true,
  "allowedChannelIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "credentialMode" varchar(16) NOT NULL DEFAULT 'managed',
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "signingSecretEncrypted" text,
  "slackTeamId" varchar(128),
  "slackTeamName" varchar(256),
  "botUserId" varchar(128),
  "botTokenEncrypted" text,
  "installedAt" timestamp,
  "installedByUserId" uuid REFERENCES "User"("id") ON DELETE SET NULL,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
