ALTER TABLE "TenantMember"
  ADD COLUMN IF NOT EXISTS "profileOnboardingCompletedAt" timestamp;

UPDATE "TenantMember"
SET "profileOnboardingCompletedAt" = COALESCE("lastLoginAt", "updatedAt", NOW())
WHERE "profileOnboardingCompletedAt" IS NULL;
