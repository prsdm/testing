ALTER TABLE "TenantGeneralSettings" ADD COLUMN IF NOT EXISTS "sandboxEnabled" boolean DEFAULT false NOT NULL;

ALTER TABLE "TenantUsageEvent" ADD COLUMN IF NOT EXISTS "sandboxExecCount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "TenantUsageEvent" ADD COLUMN IF NOT EXISTS "sandboxExecDurationMs" integer DEFAULT 0 NOT NULL;
