DO $$ BEGIN
  CREATE TYPE "public"."llm_provider_name" AS ENUM('openai', 'anthropic');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TenantLlmProvider" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "provider" "llm_provider_name" NOT NULL,
  "name" varchar(255),
  "apiKeyEncrypted" text,
  "apiBase" varchar(512),
  "isEnabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantLlmProvider"
    ADD CONSTRAINT "TenantLlmProvider_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TenantLlmProvider_tenant_provider_unique"
  ON "TenantLlmProvider" ("tenantId", "provider");

CREATE INDEX IF NOT EXISTS "TenantLlmProvider_tenantId_idx"
  ON "TenantLlmProvider" ("tenantId");

CREATE TABLE IF NOT EXISTS "TenantLlmModelConfiguration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "llmProviderId" uuid NOT NULL,
  "modelId" varchar(128) NOT NULL,
  "displayName" varchar(255),
  "isVisible" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantLlmModelConfiguration"
    ADD CONSTRAINT "TenantLlmModelConfiguration_llmProviderId_TenantLlmProvider_id_fk"
    FOREIGN KEY ("llmProviderId") REFERENCES "public"."TenantLlmProvider"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TenantLlmModelConfiguration_provider_model_unique"
  ON "TenantLlmModelConfiguration" ("llmProviderId", "modelId");

CREATE INDEX IF NOT EXISTS "TenantLlmModelConfiguration_llmProviderId_idx"
  ON "TenantLlmModelConfiguration" ("llmProviderId");

CREATE TABLE IF NOT EXISTS "TenantLlmSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "defaultChatModelId" varchar(128),
  "defaultTitleModelId" varchar(128),
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantLlmSettings"
    ADD CONSTRAINT "TenantLlmSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
