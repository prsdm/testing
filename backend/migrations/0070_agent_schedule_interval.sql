ALTER TABLE "AgentSchedule" ADD COLUMN "intervalMinutes" integer;
--> statement-breakpoint
UPDATE "AgentSchedule" SET "intervalMinutes" = 1440 WHERE "intervalMinutes" IS NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ALTER COLUMN "intervalMinutes" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" DROP COLUMN "frequency";
--> statement-breakpoint
ALTER TABLE "AgentSchedule" DROP COLUMN "dayOfWeek";
--> statement-breakpoint
ALTER TABLE "AgentSchedule" DROP COLUMN "timeLocal";
--> statement-breakpoint
ALTER TABLE "AgentSchedule" DROP COLUMN "timezone";
