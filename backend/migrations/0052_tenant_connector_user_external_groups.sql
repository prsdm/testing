CREATE TABLE IF NOT EXISTS "TenantConnectorUserExternalGroup" (
  "tenantId" uuid NOT NULL,
  "sourceType" varchar(32) NOT NULL,
  "userEmail" varchar(320) NOT NULL,
  "externalGroupId" varchar(512) NOT NULL,
  "stale" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantConnectorUserExternalGroup_pkey" PRIMARY KEY ("tenantId", "sourceType", "userEmail", "externalGroupId")
);

DO $$ BEGIN
  ALTER TABLE "TenantConnectorUserExternalGroup"
    ADD CONSTRAINT "TenantConnectorUserExternalGroup_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantConnectorUserExternalGroup_tenant_source_user_stale_idx"
  ON "TenantConnectorUserExternalGroup" ("tenantId", "sourceType", "userEmail", "stale");
