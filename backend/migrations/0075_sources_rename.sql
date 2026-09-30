-- Rename KB/Knowledge schema to Sources (enums, tables, agent columns, indexes).

ALTER TYPE "kb_source_type" RENAME TO "source_connector_type";
ALTER TYPE "kb_visibility" RENAME TO "source_visibility";
ALTER TYPE "kb_access_principal_type" RENAME TO "source_access_principal_type";
ALTER TYPE "kb_access_role" RENAME TO "source_access_role";

ALTER TABLE "PersonalKbItem" RENAME TO "PersonalSource";
ALTER TABLE "TeamKbItem" RENAME TO "TeamSource";
ALTER TABLE "KnowledgeAccessGrant" RENAME TO "SourceAccessGrant";

ALTER TABLE "SourceAccessGrant" RENAME COLUMN "knowledgeItemId" TO "sourceItemId";

ALTER TABLE "Agent" RENAME COLUMN "allowedKbSourceTypes" TO "allowedSourceConnectorTypes";
ALTER TABLE "Agent" RENAME COLUMN "allowedKbItemIds" TO "allowedSourceItemIds";
ALTER TABLE "Agent" RENAME COLUMN "knowledgeSearchEnabled" TO "sourceSearchEnabled";

ALTER INDEX "PersonalKbItem_tenant_user_idx" RENAME TO "PersonalSource_tenant_user_idx";
ALTER INDEX "TeamKbItem_tenant_idx" RENAME TO "TeamSource_tenant_idx";
ALTER INDEX IF EXISTS "TeamKbItem_access_control_list_gin_idx" RENAME TO "TeamSource_access_control_list_gin_idx";
ALTER INDEX "KnowledgeAccessGrant_tenant_idx" RENAME TO "SourceAccessGrant_tenant_idx";
ALTER INDEX "KnowledgeAccessGrant_item_idx" RENAME TO "SourceAccessGrant_item_idx";
ALTER INDEX "KnowledgeAccessGrant_principal_idx" RENAME TO "SourceAccessGrant_principal_idx";
ALTER INDEX IF EXISTS "KnowledgeAccessGrant_unique_principal_role_idx" RENAME TO "SourceAccessGrant_unique_principal_role_idx";
