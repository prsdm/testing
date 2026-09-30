CREATE TABLE IF NOT EXISTS "TenantSlackIndexedChannel" (
  "tenantId" uuid NOT NULL,
  "channelId" varchar(64) NOT NULL,
  "channelName" varchar(255),
  "lastMessageTs" varchar(64) DEFAULT '' NOT NULL,
  "lastIndexedAt" timestamp DEFAULT now() NOT NULL,
  "lastStatus" varchar(32) DEFAULT 'indexed' NOT NULL,
  CONSTRAINT "TenantSlackIndexedChannel_pkey" PRIMARY KEY ("tenantId", "channelId")
);

DO $$ BEGIN
  ALTER TABLE "TenantSlackIndexedChannel"
    ADD CONSTRAINT "TenantSlackIndexedChannel_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantSlackIndexedChannel_tenant_status_idx"
  ON "TenantSlackIndexedChannel" ("tenantId", "lastStatus");
