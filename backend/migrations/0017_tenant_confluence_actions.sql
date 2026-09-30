CREATE TABLE IF NOT EXISTS "TenantConfluenceActionsSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "confluenceActionsEnabled" boolean DEFAULT false NOT NULL,
  "siteUrl" varchar(512),
  "allowRead" boolean DEFAULT true NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantConfluenceActionsSettings"
    ADD CONSTRAINT "TenantConfluenceActionsSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
