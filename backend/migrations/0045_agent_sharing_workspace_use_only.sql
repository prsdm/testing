UPDATE "Agent"
SET "workspaceAccess" = 'use'
WHERE "availabilityMode" = 'everyone';
--> statement-breakpoint
DELETE FROM "AgentMember" am
USING "Agent" a, "TenantMember" tm
WHERE am."agentId" = a.id
  AND tm."tenantId" = a."tenantId"
  AND tm."authUserId" = a."ownedByUserId"
  AND am."memberId" = tm.id;
