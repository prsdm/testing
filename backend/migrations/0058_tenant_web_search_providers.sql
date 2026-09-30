DO $$ BEGIN
  CREATE TYPE "public"."web_search_provider_category" AS ENUM('search', 'content');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TenantWebSearchProvider" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "category" "web_search_provider_category" NOT NULL,
  "providerType" varchar(64) NOT NULL,
  "apiKeyEncrypted" text,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "isActive" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantWebSearchProvider"
    ADD CONSTRAINT "TenantWebSearchProvider_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TenantWebSearchProvider_tenant_category_provider_unique"
  ON "TenantWebSearchProvider" ("tenantId", "category", "providerType");

CREATE INDEX IF NOT EXISTS "TenantWebSearchProvider_tenantId_idx"
  ON "TenantWebSearchProvider" ("tenantId");
