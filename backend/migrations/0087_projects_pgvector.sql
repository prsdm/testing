CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Project" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  name varchar(512) NOT NULL,
  instructions text,
  "createdByUserId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "Project_tenant_idx" ON "Project" ("tenantId");
CREATE INDEX "Project_created_by_idx" ON "Project" ("createdByUserId");

CREATE TABLE "ProjectSource" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "projectId" uuid NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sourceItemId" uuid NOT NULL REFERENCES "TeamSource"(id) ON DELETE CASCADE,
  "addedByUserId" text NOT NULL,
  "addedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ProjectSource_project_source_unique" UNIQUE ("projectId", "sourceItemId")
);

CREATE INDEX "ProjectSource_project_idx" ON "ProjectSource" ("projectId");
CREATE INDEX "ProjectSource_source_item_idx" ON "ProjectSource" ("sourceItemId");

CREATE TABLE "SourceChunk" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "projectId" uuid NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sourceItemId" uuid NOT NULL REFERENCES "TeamSource"(id) ON DELETE CASCADE,
  "chunkIndex" integer NOT NULL,
  title text DEFAULT '' NOT NULL,
  content text NOT NULL,
  blurb text DEFAULT '' NOT NULL,
  link text DEFAULT '' NOT NULL,
  "contentEmbedding" vector(768) NOT NULL,
  "titleEmbedding" vector(768),
  "accessControlList" text[] DEFAULT '{}' NOT NULL,
  "sourceConnectorType" varchar(64),
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  search_text tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || content)
  ) STORED,
  CONSTRAINT "SourceChunk_project_source_chunk_unique" UNIQUE ("projectId", "sourceItemId", "chunkIndex")
);

CREATE INDEX "SourceChunk_project_idx" ON "SourceChunk" ("projectId");
CREATE INDEX "SourceChunk_tenant_idx" ON "SourceChunk" ("tenantId");
CREATE INDEX "SourceChunk_source_item_idx" ON "SourceChunk" ("sourceItemId");
CREATE INDEX "SourceChunk_content_embedding_hnsw_idx" ON "SourceChunk" USING hnsw ("contentEmbedding" vector_cosine_ops);
CREATE INDEX "SourceChunk_search_text_gin_idx" ON "SourceChunk" USING gin (search_text);
CREATE INDEX "SourceChunk_access_control_list_gin_idx" ON "SourceChunk" USING gin ("accessControlList");

ALTER TABLE "Chat" ADD COLUMN "projectId" uuid REFERENCES "Project"(id) ON DELETE SET NULL;
CREATE INDEX "Chat_project_idx" ON "Chat" ("projectId");
