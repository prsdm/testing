ALTER TABLE "AgentSchedule" ADD COLUMN "slackPostEnabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "slackPostDestinationType" varchar(16);
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "slackPostChannelId" varchar(64);
--> statement-breakpoint
ALTER TABLE "AgentSchedule" ADD COLUMN "slackPostChannelName" varchar(255);
