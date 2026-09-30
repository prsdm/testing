DO $$ BEGIN
 CREATE TYPE "public"."people_sync_source" AS ENUM('scim', 'idp_pull');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."people_sync_status" AS ENUM('active', 'inactive', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."people_sync_run_status" AS ENUM('running', 'success', 'partial', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "TenantIdentity"
  ADD COLUMN IF NOT EXISTS "source" "people_sync_source" DEFAULT 'scim' NOT NULL;
--> statement-breakpoint
ALTER TABLE "TenantIdentity"
  ADD COLUMN IF NOT EXISTS "externalId" text;
--> statement-breakpoint
ALTER TABLE "TenantIdentity"
  ADD COLUMN IF NOT EXISTS "syncStatus" "people_sync_status" DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "TenantIdentity"
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantPerson" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "externalId" text,
  "email" varchar(255) NOT NULL,
  "firstName" varchar(255),
  "lastName" varchar(255),
  "displayName" varchar(255),
  "department" varchar(255),
  "title" varchar(255),
  "managerEmail" varchar(255),
  "location" varchar(255),
  "source" "people_sync_source" DEFAULT 'scim' NOT NULL,
  "status" "people_sync_status" DEFAULT 'active' NOT NULL,
  "lastSyncedAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPerson" ADD CONSTRAINT "TenantPerson_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPerson" ADD CONSTRAINT "tenant_person_tenant_email_unique" UNIQUE("tenantId", "email");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantPeopleGroup" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "externalId" text,
  "name" varchar(255) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroup" ADD CONSTRAINT "TenantPeopleGroup_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroup" ADD CONSTRAINT "tenant_people_group_tenant_name_unique" UNIQUE("tenantId", "name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantPeopleGroupMember" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "groupId" uuid NOT NULL,
  "personId" uuid NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroupMember" ADD CONSTRAINT "TenantPeopleGroupMember_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroupMember" ADD CONSTRAINT "TenantPeopleGroupMember_groupId_TenantPeopleGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."TenantPeopleGroup"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroupMember" ADD CONSTRAINT "TenantPeopleGroupMember_personId_TenantPerson_id_fk" FOREIGN KEY ("personId") REFERENCES "public"."TenantPerson"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleGroupMember" ADD CONSTRAINT "tenant_people_group_member_unique" UNIQUE("tenantId", "groupId", "personId");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantPeopleSyncRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "provider" "sso_provider" NOT NULL,
  "source" "people_sync_source" NOT NULL,
  "status" "people_sync_run_status" DEFAULT 'running' NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "completedAt" timestamp,
  "usersProcessed" bigint DEFAULT 0 NOT NULL,
  "usersUpserted" bigint DEFAULT 0 NOT NULL,
  "usersDeactivated" bigint DEFAULT 0 NOT NULL,
  "errorsCount" bigint DEFAULT 0 NOT NULL,
  "metadata" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleSyncRun" ADD CONSTRAINT "TenantPeopleSyncRun_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantPeopleSyncIssue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "personEmail" varchar(255),
  "externalId" text,
  "issueCode" varchar(100) NOT NULL,
  "issueMessage" text NOT NULL,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantPeopleSyncIssue" ADD CONSTRAINT "TenantPeopleSyncIssue_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
