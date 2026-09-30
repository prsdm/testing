ALTER TYPE "tenant_member_role" RENAME VALUE 'member' TO 'basic';
--> statement-breakpoint
ALTER TABLE "TenantMember" ALTER COLUMN "role" SET DEFAULT 'basic';
