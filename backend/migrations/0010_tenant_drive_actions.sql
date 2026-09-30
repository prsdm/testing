CREATE TABLE IF NOT EXISTS "TenantDriveActionsSettings" (
  "tenantId" uuid PRIMARY KEY NOT NULL,
  "driveActionsEnabled" boolean DEFAULT false NOT NULL,
  "oauthClientId" varchar(512),
  "oauthClientSecretEncrypted" text,
  "allowRead" boolean DEFAULT true NOT NULL,
  "allowCreate" boolean DEFAULT true NOT NULL,
  "allowWrite" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "TenantDriveActionsSettings"
    ADD CONSTRAINT "TenantDriveActionsSettings_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "UserDriveConnection" (
  "tenantId" uuid NOT NULL,
  "userEmail" varchar(320) NOT NULL,
  "googleAccountEmail" varchar(320) NOT NULL,
  "accessTokenEncrypted" text NOT NULL,
  "refreshTokenEncrypted" text,
  "scopes" text NOT NULL,
  "expiresAt" timestamp,
  "connectedAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "UserDriveConnection_pkey" PRIMARY KEY ("tenantId", "userEmail")
);

DO $$ BEGIN
  ALTER TABLE "UserDriveConnection"
    ADD CONSTRAINT "UserDriveConnector_tenantId_Tenant_id_fk"
    FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
