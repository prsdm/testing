-- Per-seat allowance semantics: TenantUsageSettings.monthlyAllowanceUsdCents
-- is the default per-seat included usage (e.g. $15). Workspace pool =
-- active seats × that amount. Optional overrides live here.
CREATE TABLE IF NOT EXISTS "TenantMemberUsageQuota" (
  "tenantId" uuid NOT NULL,
  "authUserId" text NOT NULL,
  "monthlyQuotaUsdCents" integer NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantMemberUsageQuota_pkey" PRIMARY KEY ("tenantId", "authUserId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantMemberUsageQuota" ADD CONSTRAINT "TenantMemberUsageQuota_tenantId_Tenant_id_fk"
   FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantMemberUsageQuota" ADD CONSTRAINT "TenantMemberUsageQuota_authUserId_user_id_fk"
   FOREIGN KEY ("authUserId") REFERENCES "public"."user"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_member_usage_quota_tenant_idx"
  ON "TenantMemberUsageQuota" ("tenantId");
--> statement-breakpoint
ALTER TABLE "TenantMemberUsageQuota" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "TenantMemberUsageQuota";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "TenantMemberUsageQuota" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
