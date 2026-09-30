ALTER TABLE "Agent"
  ADD COLUMN IF NOT EXISTS "availabilityMode" varchar(16) DEFAULT 'everyone' NOT NULL;

CREATE TABLE IF NOT EXISTS "AgentMember" (
  "agentId" uuid NOT NULL,
  "memberId" uuid NOT NULL,
  CONSTRAINT "AgentMember_agentId_memberId_pk" PRIMARY KEY ("agentId", "memberId"),
  CONSTRAINT "AgentMember_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "AgentMember_memberId_TenantMember_id_fk" FOREIGN KEY ("memberId") REFERENCES "public"."TenantMember"("id") ON DELETE cascade ON UPDATE no action
);
