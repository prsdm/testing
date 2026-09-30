CREATE TABLE IF NOT EXISTS "TenantDriveIndexedFile" (
  "tenantId" uuid NOT NULL,
  "driveFileId" varchar(128) NOT NULL,
  "driveModifiedTime" varchar(64) NOT NULL,
  "documentId" varchar(160) NOT NULL,
  "lastIndexedAt" timestamp DEFAULT now() NOT NULL,
  "lastStatus" varchar(32) DEFAULT 'indexed' NOT NULL,
  CONSTRAINT "TenantDriveIndexedFile_pkey" PRIMARY KEY ("tenantId", "driveFileId")
);

DO $$ BEGIN
  ALTER TABLE "TenantDriveIndexedFile"
    ADD CONSTRAINT "TenantDriveIndexedFile_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantDriveIndexedFile_tenant_status_idx"
  ON "TenantDriveIndexedFile" ("tenantId", "lastStatus");
