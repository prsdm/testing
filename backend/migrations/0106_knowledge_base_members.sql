DO $$ BEGIN
 CREATE TYPE "knowledge_base_member_role" AS ENUM('editor', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "KnowledgeBaseMember" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "knowledgeBaseId" uuid NOT NULL,
  "userId" text NOT NULL,
  "role" "knowledge_base_member_role" NOT NULL DEFAULT 'viewer',
  "addedByUserId" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "KnowledgeBaseMember" ADD CONSTRAINT "KnowledgeBaseMember_knowledgeBaseId_KnowledgeBase_id_fk" FOREIGN KEY ("knowledgeBaseId") REFERENCES "public"."KnowledgeBase"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeBaseMember_kb_user_unique" ON "KnowledgeBaseMember" ("knowledgeBaseId", "userId");
CREATE INDEX IF NOT EXISTS "KnowledgeBaseMember_knowledge_base_idx" ON "KnowledgeBaseMember" ("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "KnowledgeBaseMember_user_idx" ON "KnowledgeBaseMember" ("userId");
