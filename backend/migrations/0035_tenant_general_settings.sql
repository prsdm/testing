CREATE TABLE IF NOT EXISTS "TenantGeneralSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "teamContext" text,
  "customGreeting" text,
  "customGreetingSubtitle" text,
  "chatDisclaimer" text,
  "logoUrl" text,
  "maximumChatRetentionDays" integer,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
