DO $$ BEGIN
 CREATE TYPE "public"."sso_config_status" AS ENUM('pending', 'active', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sso_provider" AS ENUM('google_workspace', 'okta', 'azure_ad');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tenant_status" AS ENUM('pending_setup', 'active', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantAdminContact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_admin_contact_unique" UNIQUE("tenantId","email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantDomain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantIdentity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"provider" "sso_provider" NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"userData" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_identity_provider_subject_unique" UNIQUE("tenantId","issuer","subject")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantSCIMConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"bearerTokenHash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"rotationVersion" bigint DEFAULT 1 NOT NULL,
	"rotatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantSetupToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_setup_token_hash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TenantSSOConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenantId" uuid NOT NULL,
	"provider" "sso_provider" NOT NULL,
	"issuerUrl" text NOT NULL,
	"clientId" text NOT NULL,
	"clientSecretEncrypted" text NOT NULL,
	"status" "sso_config_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companyName" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"primaryDomain" varchar(255) NOT NULL,
	"status" "tenant_status" DEFAULT 'pending_setup' NOT NULL,
	"neonProjectId" text,
	"dbUrlEncrypted" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantAdminContact" ADD CONSTRAINT "TenantAdminContact_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantIdentity" ADD CONSTRAINT "TenantIdentity_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantSCIMConfig" ADD CONSTRAINT "TenantSCIMConfig_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantSetupToken" ADD CONSTRAINT "TenantSetupToken_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantSSOConfig" ADD CONSTRAINT "TenantSSOConfig_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
