DO $$ BEGIN
 CREATE TYPE "public"."agent_workspace_access" AS ENUM('view', 'edit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."agent_member_role" AS ENUM('view', 'edit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "workspaceAccess" "agent_workspace_access";
--> statement-breakpoint
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "isWorkspaceDefault" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AgentMember" ADD COLUMN IF NOT EXISTS "role" "agent_member_role" DEFAULT 'view' NOT NULL;
--> statement-breakpoint
UPDATE "Agent"
SET "workspaceAccess" = 'view'
WHERE "isPublished" = true
  AND "availabilityMode" = 'everyone'
  AND "workspaceAccess" IS NULL;
--> statement-breakpoint
UPDATE "Agent" a
SET
  "allowedKbItemIds" = uk."allowedKbItemIds",
  "knowledgeSearchEnabled" = (jsonb_array_length(uk."allowedKbItemIds") > 0)
FROM "AgentUserKnowledge" uk
WHERE a."id" = uk."agentId"
  AND a."ownedByUserId" = uk."authUserId"
  AND jsonb_array_length(uk."allowedKbItemIds") > 0;
--> statement-breakpoint
DROP TABLE IF EXISTS "AgentUserKnowledge";
