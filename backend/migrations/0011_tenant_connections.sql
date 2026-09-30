DO $$ BEGIN
  CREATE TYPE "public"."credential_type" AS ENUM('api_key', 'oauth2');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."connection_status" AS ENUM('draft', 'active');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."connection_access_role" AS ENUM('owner', 'use');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Credential" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" "credential_type" NOT NULL,
  "provider" varchar(64),
  "secretEncrypted" text NOT NULL,
  "oauthScopes" json,
  "ownedByUserId" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Credential"
    ADD CONSTRAINT "Credential_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Credential"
    ADD CONSTRAINT "Credential_ownedByUserId_user_id_fk"
    FOREIGN KEY ("ownedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Credential_tenantId_idx" ON "Credential" ("tenantId");
CREATE INDEX IF NOT EXISTS "Credential_ownedByUserId_idx" ON "Credential" ("ownedByUserId");

CREATE TABLE IF NOT EXISTS "Connection" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" "connection_status" DEFAULT 'draft' NOT NULL,
  "ownedByUserId" text,
  "toolOrder" json,
  "source" varchar(32),
  "createdBy" text,
  "updatedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_ownedByUserId_user_id_fk"
    FOREIGN KEY ("ownedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_createdBy_user_id_fk"
    FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Connection"
    ADD CONSTRAINT "Connection_updatedBy_user_id_fk"
    FOREIGN KEY ("updatedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Connection_tenantId_idx" ON "Connection" ("tenantId");
CREATE INDEX IF NOT EXISTS "Connection_ownedByUserId_idx" ON "Connection" ("ownedByUserId");

CREATE TABLE IF NOT EXISTS "ConnectionAccess" (
  "connectionId" uuid NOT NULL,
  "userId" text NOT NULL,
  "role" "connection_access_role" DEFAULT 'use' NOT NULL,
  "grantedBy" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ConnectionAccess_pkey" PRIMARY KEY ("connectionId", "userId")
);

DO $$ BEGIN
  ALTER TABLE "ConnectionAccess"
    ADD CONSTRAINT "ConnectionAccess_connectionId_Connection_id_fk"
    FOREIGN KEY ("connectionId") REFERENCES "public"."Connection"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConnectionAccess"
    ADD CONSTRAINT "ConnectionAccess_userId_user_id_fk"
    FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ConnectionAccess"
    ADD CONSTRAINT "ConnectionAccess_grantedBy_user_id_fk"
    FOREIGN KEY ("grantedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ConnectionAccess_userId_idx" ON "ConnectionAccess" ("userId");

CREATE TABLE IF NOT EXISTS "ToolConfig" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "providerId" varchar(64) NOT NULL,
  "toolId" varchar(128) NOT NULL,
  "name" varchar(255),
  "connectionId" uuid,
  "credentialId" uuid,
  "ownedByUserId" text,
  "configEncrypted" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ToolConfig"
    ADD CONSTRAINT "ToolConfig_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ToolConfig"
    ADD CONSTRAINT "ToolConfig_connectionId_Connection_id_fk"
    FOREIGN KEY ("connectionId") REFERENCES "public"."Connection"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ToolConfig"
    ADD CONSTRAINT "ToolConfig_credentialId_Credential_id_fk"
    FOREIGN KEY ("credentialId") REFERENCES "public"."Credential"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ToolConfig"
    ADD CONSTRAINT "ToolConfig_ownedByUserId_user_id_fk"
    FOREIGN KEY ("ownedByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ToolConfig_tenantId_idx" ON "ToolConfig" ("tenantId");
CREATE INDEX IF NOT EXISTS "ToolConfig_connectionId_idx" ON "ToolConfig" ("connectionId");
CREATE INDEX IF NOT EXISTS "ToolConfig_ownedByUserId_idx" ON "ToolConfig" ("ownedByUserId");

DROP TABLE IF EXISTS "UserDriveConnection";
