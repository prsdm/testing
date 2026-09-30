CREATE TABLE IF NOT EXISTS "TenantWebSearchSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "maxAutoReadPages" integer DEFAULT 5 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantWebSearchSettings"
    ADD CONSTRAINT "TenantWebSearchSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
