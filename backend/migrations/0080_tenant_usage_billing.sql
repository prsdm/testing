CREATE TABLE IF NOT EXISTS "TenantUsageSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "monthlyAllowanceUsdCents" integer DEFAULT 1500 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantUsageSettings" ADD CONSTRAINT "TenantUsageSettings_tenantId_Tenant_id_fk"
   FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantUsageEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "authUserId" text,
  "chatId" uuid,
  "source" varchar(32) DEFAULT 'chat' NOT NULL,
  "modelId" varchar(128),
  "inputTokens" integer DEFAULT 0 NOT NULL,
  "outputTokens" integer DEFAULT 0 NOT NULL,
  "totalTokens" integer DEFAULT 0 NOT NULL,
  "webSearchCount" integer DEFAULT 0 NOT NULL,
  "estimatedCostUsdMicros" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantUsageEvent" ADD CONSTRAINT "TenantUsageEvent_tenantId_Tenant_id_fk"
   FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_event_tenant_created_idx"
  ON "TenantUsageEvent" ("tenantId", "createdAt");
--> statement-breakpoint
ALTER TABLE "TenantUsageSettings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "TenantUsageSettings";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "TenantUsageSettings" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
--> statement-breakpoint
ALTER TABLE "TenantUsageEvent" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "TenantUsageEvent";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "TenantUsageEvent" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
