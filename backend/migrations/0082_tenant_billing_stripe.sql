-- Stripe subscription state + raise default per-seat allowance to $20.
CREATE TABLE IF NOT EXISTS "TenantBilling" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "stripeSubscriptionItemId" text,
  "stripeOnDemandItemId" text,
  "status" varchar(32) DEFAULT 'none' NOT NULL,
  "interval" varchar(16),
  "seatQuantity" integer DEFAULT 0 NOT NULL,
  "onDemandEnabled" boolean DEFAULT false NOT NULL,
  "currentPeriodStart" timestamp,
  "currentPeriodEnd" timestamp,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantBilling" ADD CONSTRAINT "TenantBilling_tenantId_Tenant_id_fk"
   FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_billing_stripe_customer_uidx"
  ON "TenantBilling" ("stripeCustomerId")
  WHERE "stripeCustomerId" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_billing_stripe_subscription_uidx"
  ON "TenantBilling" ("stripeSubscriptionId")
  WHERE "stripeSubscriptionId" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "TenantBilling" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "TenantBilling";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "TenantBilling" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
--> statement-breakpoint
ALTER TABLE "TenantUsageSettings"
  ALTER COLUMN "monthlyAllowanceUsdCents" SET DEFAULT 2000;
--> statement-breakpoint
UPDATE "TenantUsageSettings"
SET "monthlyAllowanceUsdCents" = 2000
WHERE "monthlyAllowanceUsdCents" = 1500;
