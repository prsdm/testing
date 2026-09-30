DO $$ BEGIN
  CREATE TYPE "kb_visibility" AS ENUM ('private', 'shared');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "kb_access_principal_type" AS ENUM ('user', 'tenant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "kb_access_role" AS ENUM ('owner', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "visibility" "kb_visibility";

UPDATE "TeamKbItem"
SET "visibility" = CASE
  WHEN "sourceType" = 'drive' THEN 'shared'::"kb_visibility"
  ELSE 'private'::"kb_visibility"
END
WHERE "visibility" IS NULL;

ALTER TABLE "TeamKbItem"
  ALTER COLUMN "visibility" SET DEFAULT 'private'::"kb_visibility";

ALTER TABLE "TeamKbItem"
  ALTER COLUMN "visibility" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "KnowledgeAccessGrant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "knowledgeItemId" uuid NOT NULL,
  "principalType" "kb_access_principal_type" NOT NULL,
  "principalId" text,
  "role" "kb_access_role" DEFAULT 'viewer' NOT NULL,
  "grantedByUserId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "KnowledgeAccessGrant"
    ADD CONSTRAINT "KnowledgeAccessGrant_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeAccessGrant"
    ADD CONSTRAINT "KnowledgeAccessGrant_knowledgeItemId_TeamKbItem_id_fk"
    FOREIGN KEY ("knowledgeItemId") REFERENCES "public"."TeamKbItem"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeAccessGrant"
    ADD CONSTRAINT "KnowledgeAccessGrant_grantedByUserId_user_id_fk"
    FOREIGN KEY ("grantedByUserId") REFERENCES "public"."user"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "KnowledgeAccessGrant_tenant_idx"
  ON "KnowledgeAccessGrant" ("tenantId");

CREATE INDEX IF NOT EXISTS "KnowledgeAccessGrant_item_idx"
  ON "KnowledgeAccessGrant" ("knowledgeItemId");

CREATE INDEX IF NOT EXISTS "KnowledgeAccessGrant_principal_idx"
  ON "KnowledgeAccessGrant" ("principalType", "principalId");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeAccessGrant_unique_principal_role_idx"
  ON "KnowledgeAccessGrant" (
    "knowledgeItemId",
    "principalType",
    COALESCE("principalId", '__tenant__'),
    "role"
  );

-- Backfill owner grants for existing KB items.
INSERT INTO "KnowledgeAccessGrant" (
  "tenantId",
  "knowledgeItemId",
  "principalType",
  "principalId",
  "role",
  "grantedByUserId"
)
SELECT
  t."tenantId",
  t."id",
  'user'::"kb_access_principal_type",
  t."createdByUserId",
  'owner'::"kb_access_role",
  t."createdByUserId"
FROM "TeamKbItem" t
WHERE t."createdByUserId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill shared viewer grants at tenant scope.
INSERT INTO "KnowledgeAccessGrant" (
  "tenantId",
  "knowledgeItemId",
  "principalType",
  "principalId",
  "role",
  "grantedByUserId"
)
SELECT
  t."tenantId",
  t."id",
  'tenant'::"kb_access_principal_type",
  NULL,
  'viewer'::"kb_access_role",
  t."createdByUserId"
FROM "TeamKbItem" t
WHERE t."visibility" = 'shared'::"kb_visibility"
ON CONFLICT DO NOTHING;
