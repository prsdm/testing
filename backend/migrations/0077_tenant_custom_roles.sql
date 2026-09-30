CREATE TABLE IF NOT EXISTS "TenantCustomRole" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantCustomRoleCapability" (
  "roleId" uuid NOT NULL,
  "capability" varchar(64) NOT NULL,
  CONSTRAINT "TenantCustomRoleCapability_roleId_capability_pk" PRIMARY KEY ("roleId", "capability")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantMemberCustomRole" (
  "memberId" uuid NOT NULL,
  "roleId" uuid NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantMemberCustomRole_memberId_roleId_pk" PRIMARY KEY ("memberId", "roleId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantCustomRole" ADD CONSTRAINT "TenantCustomRole_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantCustomRoleCapability" ADD CONSTRAINT "TenantCustomRoleCapability_roleId_TenantCustomRole_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."TenantCustomRole"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantMemberCustomRole" ADD CONSTRAINT "TenantMemberCustomRole_memberId_TenantMember_id_fk" FOREIGN KEY ("memberId") REFERENCES "public"."TenantMember"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantMemberCustomRole" ADD CONSTRAINT "TenantMemberCustomRole_roleId_TenantCustomRole_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."TenantCustomRole"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantCustomRole" ADD CONSTRAINT "tenant_custom_role_tenant_name_unique" UNIQUE ("tenantId", "name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
