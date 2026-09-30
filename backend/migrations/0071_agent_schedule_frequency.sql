ALTER TABLE "AgentSchedule" ADD COLUMN "frequency" varchar(16);
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "dayOfWeek" integer;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "timeBucket" varchar(16);
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "timezone" varchar(64);
--> statement-breakpoint
UPDATE "AgentSchedule"
SET
	"frequency" = 'hourly',
	"timezone" = 'UTC'
WHERE "frequency" IS NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ALTER COLUMN "frequency" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ALTER COLUMN "timezone" SET NOT NULL;
