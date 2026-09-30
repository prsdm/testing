ALTER TABLE "TenantUsageEvent" ADD COLUMN IF NOT EXISTS "imageGenerationCount" integer DEFAULT 0 NOT NULL;
