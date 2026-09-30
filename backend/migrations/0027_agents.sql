CREATE TABLE IF NOT EXISTS "Agent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "slug" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "systemPrompt" text NOT NULL,
  "allowedProviderIds" jsonb,
  "knowledgeSearchEnabled" boolean DEFAULT true NOT NULL,
  "webSearchEnabled" boolean DEFAULT false NOT NULL,
  "modelId" varchar(128),
  "ownedByUserId" text,
  "isPublished" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownedByUserId_user_id_fk"
    FOREIGN KEY ("ownedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_tenantId_slug_unique" ON "Agent" ("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "Agent_tenantId_idx" ON "Agent" ("tenantId");
CREATE INDEX IF NOT EXISTS "Agent_ownedByUserId_idx" ON "Agent" ("ownedByUserId");
