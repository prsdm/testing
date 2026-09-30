CREATE TABLE IF NOT EXISTS "TenantDriveUserExternalGroup" (
  "tenantId" uuid NOT NULL,
  "userEmail" varchar(320) NOT NULL,
  "externalGroupId" varchar(512) NOT NULL,
  "stale" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantDriveUserExternalGroup_pkey" PRIMARY KEY ("tenantId", "userEmail", "externalGroupId")
);

DO $$ BEGIN
  ALTER TABLE "TenantDriveUserExternalGroup"
    ADD CONSTRAINT "TenantDriveUserExternalGroup_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantDriveUserExternalGroup_tenant_user_stale_idx"
  ON "TenantDriveUserExternalGroup" ("tenantId", "userEmail", "stale");

CREATE TABLE IF NOT EXISTS "TenantDrivePublicExternalGroup" (
  "tenantId" uuid NOT NULL,
  "externalGroupId" varchar(512) NOT NULL,
  "stale" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantDrivePublicExternalGroup_pkey" PRIMARY KEY ("tenantId", "externalGroupId")
);

DO $$ BEGIN
  ALTER TABLE "TenantDrivePublicExternalGroup"
    ADD CONSTRAINT "TenantDrivePublicExternalGroup_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantDrivePublicExternalGroup_tenant_stale_idx"
  ON "TenantDrivePublicExternalGroup" ("tenantId", "stale");
