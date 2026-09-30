UPDATE "TenantSSOConfig"
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{peopleSync}',
  (COALESCE(metadata->'peopleSync', '{}'::jsonb) - 'scimProvider')
    || jsonb_build_object('mode', 'idp_pull'),
  true
);
--> statement-breakpoint
UPDATE "TenantPerson" SET "source" = 'idp_pull' WHERE "source" = 'scim';
--> statement-breakpoint
UPDATE "TenantIdentity" SET "source" = 'idp_pull' WHERE "source" = 'scim';
--> statement-breakpoint
UPDATE "TenantPeopleSyncRun" SET "source" = 'idp_pull' WHERE "source" = 'scim';
--> statement-breakpoint
DROP TABLE IF EXISTS "TenantSCIMConfig" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "scimProvider" CASCADE;
--> statement-breakpoint
ALTER TABLE "TenantPerson" ALTER COLUMN "source" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "TenantIdentity" ALTER COLUMN "source" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "TenantPerson" ALTER COLUMN "source" TYPE text USING ("source"::text);
--> statement-breakpoint
ALTER TABLE "TenantIdentity" ALTER COLUMN "source" TYPE text USING ("source"::text);
--> statement-breakpoint
ALTER TABLE "TenantPeopleSyncRun" ALTER COLUMN "source" TYPE text USING ("source"::text);
--> statement-breakpoint
DROP TYPE IF EXISTS "people_sync_source";
--> statement-breakpoint
CREATE TYPE "people_sync_source" AS ENUM ('idp_pull');
--> statement-breakpoint
ALTER TABLE "TenantPerson" ALTER COLUMN "source" TYPE "people_sync_source" USING ('idp_pull'::"people_sync_source");
--> statement-breakpoint
ALTER TABLE "TenantIdentity" ALTER COLUMN "source" TYPE "people_sync_source" USING ('idp_pull'::"people_sync_source");
--> statement-breakpoint
ALTER TABLE "TenantPeopleSyncRun" ALTER COLUMN "source" TYPE "people_sync_source" USING ('idp_pull'::"people_sync_source");
--> statement-breakpoint
ALTER TABLE "TenantPerson" ALTER COLUMN "source" SET DEFAULT 'idp_pull'::"people_sync_source";
--> statement-breakpoint
ALTER TABLE "TenantIdentity" ALTER COLUMN "source" SET DEFAULT 'idp_pull'::"people_sync_source";
