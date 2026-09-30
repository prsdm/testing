DO $$ BEGIN
  CREATE TYPE "mcp_transport" AS ENUM ('sse', 'streamable_http');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "mcp_auth_mode" AS ENUM ('none', 'bearer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TenantMcpServer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "slug" varchar(64) NOT NULL,
  "description" text,
  "serverUrl" varchar(2048) NOT NULL,
  "transport" "mcp_transport" NOT NULL DEFAULT 'sse',
  "authMode" "mcp_auth_mode" NOT NULL DEFAULT 'none',
  "authToken" text,
  "isEnabled" boolean NOT NULL DEFAULT false,
  "availabilityMode" varchar(16) NOT NULL DEFAULT 'everyone',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "TenantMcpServer_tenantId_slug_unique" UNIQUE ("tenantId", "slug")
);

CREATE TABLE IF NOT EXISTS "TenantMcpServerMember" (
  "tenantId" uuid NOT NULL,
  "serverId" uuid NOT NULL REFERENCES "TenantMcpServer"("id") ON DELETE CASCADE,
  "memberId" uuid NOT NULL REFERENCES "TenantMember"("id") ON DELETE CASCADE,
  CONSTRAINT "TenantMcpServerMember_pk" PRIMARY KEY ("tenantId", "serverId", "memberId")
);

CREATE TABLE IF NOT EXISTS "McpUserConnection" (
  "tenantId" uuid NOT NULL,
  "serverId" uuid NOT NULL REFERENCES "TenantMcpServer"("id") ON DELETE CASCADE,
  "authUserId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "connectedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "McpUserConnection_pk" PRIMARY KEY ("serverId", "authUserId")
);

CREATE INDEX IF NOT EXISTS "TenantMcpServer_tenantId_idx" ON "TenantMcpServer" ("tenantId");
CREATE INDEX IF NOT EXISTS "McpUserConnection_authUserId_idx" ON "McpUserConnection" ("authUserId");
