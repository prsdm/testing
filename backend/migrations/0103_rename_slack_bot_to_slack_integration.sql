ALTER TABLE "TenantSlackBotSettings" RENAME TO "TenantSlackIntegrationSettings";
--> statement-breakpoint
ALTER TABLE "TenantSlackBotThread" RENAME TO "TenantSlackIntegrationThread";
--> statement-breakpoint
ALTER INDEX IF EXISTS "TenantSlackBotThread_chatId_idx" RENAME TO "TenantSlackIntegrationThread_chatId_idx";
--> statement-breakpoint
UPDATE "TenantCustomRoleCapability"
SET "capability" = 'admin.slack_integration'
WHERE "capability" = 'admin.slack_bot';
