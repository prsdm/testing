-- Prepaid top-up credits replace metered on-demand.
ALTER TABLE "TenantBilling"
  ADD COLUMN IF NOT EXISTS "topUpBalanceUsdCents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantTopUpLedger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "amountUsdCents" integer NOT NULL,
  "balanceAfterUsdCents" integer NOT NULL,
  "stripeCheckoutSessionId" text,
  "usageEventId" uuid,
  "note" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantTopUpLedger" ADD CONSTRAINT "TenantTopUpLedger_tenantId_Tenant_id_fk"
   FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_topup_ledger_checkout_uidx"
  ON "TenantTopUpLedger" ("stripeCheckoutSessionId")
  WHERE "stripeCheckoutSessionId" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_topup_ledger_tenant_created_idx"
  ON "TenantTopUpLedger" ("tenantId", "createdAt");
--> statement-breakpoint
ALTER TABLE "TenantTopUpLedger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "TenantTopUpLedger";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "TenantTopUpLedger" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
