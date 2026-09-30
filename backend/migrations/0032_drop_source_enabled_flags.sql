ALTER TABLE "TenantDriveActionsSettings" DROP COLUMN IF EXISTS "driveActionsEnabled";
ALTER TABLE "TenantConfluenceActionsSettings" DROP COLUMN IF EXISTS "confluenceActionsEnabled";
ALTER TABLE "TenantNotionActionsSettings" DROP COLUMN IF EXISTS "notionActionsEnabled";
ALTER TABLE "TenantSharePointActionsSettings" DROP COLUMN IF EXISTS "sharePointActionsEnabled";
ALTER TABLE "TenantSlackActionsSettings" DROP COLUMN IF EXISTS "slackActionsEnabled";
ALTER TABLE "TenantJiraActionsSettings" DROP COLUMN IF EXISTS "jiraActionsEnabled";
ALTER TABLE "TenantLlmProvider" DROP COLUMN IF EXISTS "isEnabled";
