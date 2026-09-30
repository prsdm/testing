ALTER TABLE "TenantSlackIndexedChannel"
  ADD COLUMN IF NOT EXISTS "indexedByUserId" text;

DO $$ BEGIN
  ALTER TABLE "TenantSlackIndexedChannel"
    ADD CONSTRAINT "TenantSlackIndexedChannel_indexedByUserId_user_id_fk"
    FOREIGN KEY ("indexedByUserId") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TenantSlackIndexedChannel_tenant_indexer_idx"
  ON "TenantSlackIndexedChannel" ("tenantId", "indexedByUserId");
