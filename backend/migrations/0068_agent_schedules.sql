CREATE TABLE IF NOT EXISTS "AgentSchedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"authUserId" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"chatId" uuid NOT NULL,
	"frequency" varchar(16) NOT NULL,
	"dayOfWeek" integer,
	"timeLocal" varchar(5) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"nextRunAt" timestamp,
	"lastRunAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentScheduleAgent" (
	"scheduleId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "AgentScheduleAgent_scheduleId_agentId_pk" PRIMARY KEY("scheduleId","agentId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_authUserId_user_id_fk" FOREIGN KEY ("authUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentScheduleAgent" ADD CONSTRAINT "AgentScheduleAgent_scheduleId_AgentSchedule_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."AgentSchedule"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AgentScheduleAgent" ADD CONSTRAINT "AgentScheduleAgent_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AgentSchedule_chatId_unique" ON "AgentSchedule" ("chatId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentSchedule_tenant_user_idx" ON "AgentSchedule" ("tenantId","authUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentSchedule_next_run_idx" ON "AgentSchedule" ("enabled","nextRunAt");
