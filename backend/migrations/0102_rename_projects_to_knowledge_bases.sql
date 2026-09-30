ALTER TABLE "Project" RENAME TO "KnowledgeBase";
--> statement-breakpoint
ALTER TABLE "ProjectSource" RENAME TO "KnowledgeBaseSource";
--> statement-breakpoint
ALTER TABLE "TeamSource" RENAME COLUMN "projectId" TO "knowledgeBaseId";
--> statement-breakpoint
ALTER TABLE "KnowledgeBaseSource" RENAME COLUMN "projectId" TO "knowledgeBaseId";
--> statement-breakpoint
ALTER TABLE "SourceChunk" RENAME COLUMN "projectId" TO "knowledgeBaseId";
--> statement-breakpoint
ALTER TABLE "Chat" RENAME COLUMN "projectId" TO "knowledgeBaseId";
--> statement-breakpoint
ALTER INDEX IF EXISTS "Project_tenant_idx" RENAME TO "KnowledgeBase_tenant_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "Project_created_by_idx" RENAME TO "KnowledgeBase_created_by_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "ProjectSource_project_idx" RENAME TO "KnowledgeBaseSource_knowledge_base_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "ProjectSource_source_item_idx" RENAME TO "KnowledgeBaseSource_source_item_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "ProjectSource_project_source_unique" RENAME TO "KnowledgeBaseSource_knowledge_base_source_unique";
--> statement-breakpoint
ALTER INDEX IF EXISTS "SourceChunk_project_idx" RENAME TO "SourceChunk_knowledge_base_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "SourceChunk_project_source_chunk_unique" RENAME TO "SourceChunk_knowledge_base_source_chunk_unique";
--> statement-breakpoint
ALTER INDEX IF EXISTS "TeamSource_project_idx" RENAME TO "TeamSource_knowledge_base_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "Chat_project_idx" RENAME TO "Chat_knowledge_base_idx";
