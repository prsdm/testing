DO $$ BEGIN
  CREATE TYPE "kb_source_type" AS ENUM ('manual', 'drive', 'upload');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PersonalKbItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "authUserId" text NOT NULL,
  "title" varchar(512) NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "sourceType" "kb_source_type" DEFAULT 'manual' NOT NULL,
  "externalRef" varchar(1024),
  "link" varchar(2048),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "PersonalKbItem"
    ADD CONSTRAINT "PersonalKbItem_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PersonalKbItem"
    ADD CONSTRAINT "PersonalKbItem_authUserId_user_id_fk"
    FOREIGN KEY ("authUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "PersonalKbItem_tenant_user_idx"
  ON "PersonalKbItem" ("tenantId", "authUserId");

CREATE TABLE IF NOT EXISTS "TeamKbItem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "title" varchar(512) NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "sourceType" "kb_source_type" DEFAULT 'manual' NOT NULL,
  "externalRef" varchar(1024),
  "link" varchar(2048),
  "createdByUserId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TeamKbItem"
    ADD CONSTRAINT "TeamKbItem_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamKbItem"
    ADD CONSTRAINT "TeamKbItem_createdByUserId_user_id_fk"
    FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TeamKbItem_tenant_idx"
  ON "TeamKbItem" ("tenantId");
