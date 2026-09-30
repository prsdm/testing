-- Per-seat included AI + web allowance: $20 → $18.
ALTER TABLE "TenantUsageSettings"
  ALTER COLUMN "monthlyAllowanceUsdCents" SET DEFAULT 1800;
--> statement-breakpoint
UPDATE "TenantUsageSettings"
SET "monthlyAllowanceUsdCents" = 1800
WHERE "monthlyAllowanceUsdCents" = 2000;
