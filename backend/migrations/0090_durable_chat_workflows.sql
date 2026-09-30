CREATE TABLE IF NOT EXISTS "ChatWorkflowRun" (
  "workflowRunId" text PRIMARY KEY NOT NULL,
  "tenantId" uuid NOT NULL,
  "chatId" uuid NOT NULL,
  "assistantMessageId" uuid NOT NULL,
  "userMessageId" uuid NOT NULL,
  "authUserId" text NOT NULL,
  "workflowName" varchar(128) DEFAULT 'chat-turn' NOT NULL,
  "modelId" varchar(128),
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "usageEventId" uuid,
  "idempotencyKey" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ToolExecutionLedger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "workflowRunId" text NOT NULL,
  "toolCallId" text NOT NULL,
  "toolName" varchar(160) NOT NULL,
  "status" varchar(32) DEFAULT 'running' NOT NULL,
  "inputHash" text,
  "result" jsonb,
  "error" text,
  "usageEventId" uuid,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatWorkflowRun" ADD CONSTRAINT "ChatWorkflowRun_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatWorkflowRun" ADD CONSTRAINT "ChatWorkflowRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatWorkflowRun" ADD CONSTRAINT "ChatWorkflowRun_assistantMessageId_Message_v2_id_fk" FOREIGN KEY ("assistantMessageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatWorkflowRun" ADD CONSTRAINT "ChatWorkflowRun_userMessageId_Message_v2_id_fk" FOREIGN KEY ("userMessageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatWorkflowRun" ADD CONSTRAINT "ChatWorkflowRun_usageEventId_TenantUsageEvent_id_fk" FOREIGN KEY ("usageEventId") REFERENCES "public"."TenantUsageEvent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolExecutionLedger" ADD CONSTRAINT "ToolExecutionLedger_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolExecutionLedger" ADD CONSTRAINT "ToolExecutionLedger_workflowRunId_ChatWorkflowRun_workflowRunId_fk" FOREIGN KEY ("workflowRunId") REFERENCES "public"."ChatWorkflowRun"("workflowRunId") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ToolExecutionLedger" ADD CONSTRAINT "ToolExecutionLedger_usageEventId_TenantUsageEvent_id_fk" FOREIGN KEY ("usageEventId") REFERENCES "public"."TenantUsageEvent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chat_workflow_run_idempotency_unique" ON "ChatWorkflowRun" ("idempotencyKey");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_workflow_run_tenant_chat_created_idx" ON "ChatWorkflowRun" ("tenantId", "chatId", "createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tool_execution_ledger_run_call_unique" ON "ToolExecutionLedger" ("workflowRunId", "toolCallId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_execution_ledger_tenant_run_idx" ON "ToolExecutionLedger" ("tenantId", "workflowRunId");
--> statement-breakpoint
ALTER TABLE "ChatWorkflowRun" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "ChatWorkflowRun";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "ChatWorkflowRun" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
--> statement-breakpoint
ALTER TABLE "ToolExecutionLedger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS kimi_tenant_isolation ON "ToolExecutionLedger";
--> statement-breakpoint
CREATE POLICY kimi_tenant_isolation ON "ToolExecutionLedger" FOR ALL USING (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
) WITH CHECK (
  kimi_current_tenant_id() IS NULL
  OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
);
