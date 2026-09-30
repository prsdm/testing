ALTER TYPE "public"."agent_member_role" RENAME VALUE 'view' TO 'use';
--> statement-breakpoint
ALTER TYPE "public"."agent_workspace_access" RENAME VALUE 'view' TO 'use';
--> statement-breakpoint
ALTER TABLE "AgentMember" ALTER COLUMN "role" SET DEFAULT 'use'::"agent_member_role";
