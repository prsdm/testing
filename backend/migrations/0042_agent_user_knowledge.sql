CREATE TABLE IF NOT EXISTS "AgentUserKnowledge" (
  "agentId" uuid NOT NULL,
  "authUserId" text NOT NULL,
  "allowedKbItemIds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AgentUserKnowledge_agentId_authUserId_pk" PRIMARY KEY ("agentId", "authUserId"),
  CONSTRAINT "AgentUserKnowledge_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "AgentUserKnowledge_authUserId_user_id_fk" FOREIGN KEY ("authUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);

INSERT INTO "AgentUserKnowledge" ("agentId", "authUserId", "allowedKbItemIds", "updatedAt")
SELECT
  a."id",
  a."ownedByUserId",
  COALESCE(a."allowedKbItemIds", '[]'::jsonb),
  now()
FROM "Agent" a
WHERE a."ownedByUserId" IS NOT NULL
  AND a."allowedKbItemIds" IS NOT NULL
  AND jsonb_array_length(a."allowedKbItemIds") > 0
ON CONFLICT ("agentId", "authUserId") DO NOTHING;

UPDATE "Agent"
SET
  "allowedKbItemIds" = NULL,
  "knowledgeSearchEnabled" = false,
  "allowedKbSourceTypes" = NULL
WHERE "allowedKbItemIds" IS NOT NULL
   OR "knowledgeSearchEnabled" = true
   OR "allowedKbSourceTypes" IS NOT NULL;
