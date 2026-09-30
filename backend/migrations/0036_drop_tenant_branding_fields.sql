ALTER TABLE "TenantGeneralSettings"
  DROP COLUMN IF EXISTS "customGreeting",
  DROP COLUMN IF EXISTS "customGreetingSubtitle",
  DROP COLUMN IF EXISTS "chatDisclaimer";
