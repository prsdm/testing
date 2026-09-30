CREATE TYPE "tenant_member_role" AS ENUM('admin', 'member');
--> statement-breakpoint
CREATE TABLE "TenantMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"authUserId" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "tenant_member_role" DEFAULT 'member' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"personId" uuid,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_authUserId_user_id_fk" FOREIGN KEY ("authUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "TenantMember" ADD CONSTRAINT "TenantMember_personId_TenantPerson_id_fk" FOREIGN KEY ("personId") REFERENCES "public"."TenantPerson"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "TenantMember" ADD CONSTRAINT "tenant_member_tenant_auth_user_unique" UNIQUE("tenantId","authUserId");
--> statement-breakpoint
ALTER TABLE "TenantMember" ADD CONSTRAINT "tenant_member_tenant_email_unique" UNIQUE("tenantId","email");
