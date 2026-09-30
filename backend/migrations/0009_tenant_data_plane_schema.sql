ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "dataPlaneSchema" varchar(128);

CREATE INDEX IF NOT EXISTS "Tenant_data_plane_schema_idx"
  ON "Tenant" ("dataPlaneSchema")
  WHERE "dataPlaneSchema" IS NOT NULL;
