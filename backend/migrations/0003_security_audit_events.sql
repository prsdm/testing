CREATE TABLE IF NOT EXISTS "SecurityAuditEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "action" varchar(128) NOT NULL,
  "userId" text,
  "email" varchar(320),
  "tenantId" uuid REFERENCES "Tenant" ("id"),
  "resource" varchar(512),
  "ipAddress" varchar(128),
  "userAgent" text,
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "security_audit_created_at_idx"
  ON "SecurityAuditEvent" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "security_audit_tenant_created_idx"
  ON "SecurityAuditEvent" ("tenantId", "createdAt" DESC);
