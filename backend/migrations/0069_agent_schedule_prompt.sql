ALTER TABLE "AgentSchedule" ADD COLUMN "agentId" uuid;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "runPrompt" text;
--> statement-breakpoint
UPDATE "AgentSchedule" s
SET "agentId" = sub."agentId"
FROM (
	SELECT DISTINCT ON ("scheduleId") "scheduleId", "agentId"
	FROM "AgentScheduleAgent"
	ORDER BY "scheduleId", "sortOrder"
) sub
WHERE s.id = sub."scheduleId";
--> statement-breakpoint
UPDATE "AgentSchedule"
SET "runPrompt" = 'What needs my attention based on your connectors and knowledge?'
WHERE "runPrompt" IS NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ALTER COLUMN "agentId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ALTER COLUMN "runPrompt" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "AgentScheduleAgent";
