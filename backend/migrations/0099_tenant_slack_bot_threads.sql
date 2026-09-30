CREATE TABLE IF NOT EXISTS "TenantSlackBotThread" (
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "slackChannelId" varchar(128) NOT NULL,
  "slackThreadTs" varchar(64) NOT NULL,
  "chatId" uuid NOT NULL,
  "authUserId" varchar(128) NOT NULL,
  "pendingApprovalMessageTs" varchar(64),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenantId", "slackChannelId", "slackThreadTs")
);

CREATE INDEX IF NOT EXISTS "TenantSlackBotThread_chatId_idx"
  ON "TenantSlackBotThread" ("chatId");
