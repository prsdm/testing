DO $$ BEGIN
  CREATE TYPE "public"."index_run_status" AS ENUM('running', 'success', 'partial', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."index_source_type" AS ENUM('google_drive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TenantSearchSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "embeddingModel" varchar(255) DEFAULT 'nomic-ai/nomic-embed-text-v1' NOT NULL,
  "embeddingDimension" bigint DEFAULT 768 NOT NULL,
  "normalizeEmbeddings" boolean DEFAULT true NOT NULL,
  "queryPrefix" varchar(64) DEFAULT 'search_query: ' NOT NULL,
  "passagePrefix" varchar(64) DEFAULT 'search_document: ' NOT NULL,
  "maxContextLength" bigint DEFAULT 512 NOT NULL,
  "indexingEnabled" boolean DEFAULT true NOT NULL,
  "driveIndexMaxFiles" bigint DEFAULT 200 NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantSearchSettings"
    ADD CONSTRAINT "TenantSearchSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "TenantIndexRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "sourceType" "index_source_type" DEFAULT 'google_drive' NOT NULL,
  "status" "index_run_status" DEFAULT 'running' NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "documentsIndexed" bigint DEFAULT 0 NOT NULL,
  "chunksIndexed" bigint DEFAULT 0 NOT NULL,
  "errorsCount" bigint DEFAULT 0 NOT NULL,
  "errorMessage" text,
  "metadata" jsonb
);

DO $$ BEGIN
  ALTER TABLE "TenantIndexRun"
    ADD CONSTRAINT "TenantIndexRun_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
