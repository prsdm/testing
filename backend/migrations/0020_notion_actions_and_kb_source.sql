DO $$
BEGIN
  ALTER TYPE "kb_source_type" ADD VALUE IF NOT EXISTS 'notion';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TenantNotionActionsSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "notionActionsEnabled" boolean DEFAULT false NOT NULL,
  "credentialMode" varchar(16) DEFAULT 'managed' NOT NULL,
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "allowRead" boolean DEFAULT true NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantNotionActionsSettings"
    ADD CONSTRAINT "TenantNotionActionsSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
