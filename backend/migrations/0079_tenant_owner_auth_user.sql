ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerAuthUserId" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerAuthUserId_user_id_fk"
   FOREIGN KEY ("ownerAuthUserId") REFERENCES "public"."user"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Self-serve workspaces only: assign one owned workspace per user (oldest admin membership).
WITH ranked AS (
  SELECT
    t.id AS tenant_id,
    m."authUserId" AS owner_id,
    ROW_NUMBER() OVER (
      PARTITION BY m."authUserId"
      ORDER BY m."createdAt" ASC
    ) AS rn
  FROM "Tenant" t
  INNER JOIN "TenantMember" m
    ON m."tenantId" = t.id
    AND m."role" = 'admin'
  WHERE t."primaryDomain" LIKE 'ws-%.kimiro.local'
    AND t."ownerAuthUserId" IS NULL
)
UPDATE "Tenant" t
SET "ownerAuthUserId" = ranked.owner_id
FROM ranked
WHERE t.id = ranked.tenant_id
  AND ranked.rn = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_owner_auth_user_unique"
  ON "Tenant" ("ownerAuthUserId")
  WHERE "ownerAuthUserId" IS NOT NULL;
