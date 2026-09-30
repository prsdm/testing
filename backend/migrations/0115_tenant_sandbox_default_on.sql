ALTER TABLE "TenantGeneralSettings" ALTER COLUMN "sandboxEnabled" SET DEFAULT true;

UPDATE "TenantGeneralSettings"
SET "sandboxEnabled" = true
WHERE "sandboxEnabled" = false;
