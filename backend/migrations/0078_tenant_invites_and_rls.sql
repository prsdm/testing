CREATE TABLE IF NOT EXISTS "TenantInvite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "role" "tenant_member_role" DEFAULT 'basic' NOT NULL,
  "invitedByAuthUserId" text,
  "tokenHash" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "acceptedAt" timestamp,
  "revokedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_invitedByAuthUserId_user_id_fk" FOREIGN KEY ("invitedByAuthUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invite_token_hash_unique" ON "TenantInvite" ("tokenHash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invite_tenant_email_idx" ON "TenantInvite" ("tenantId", "email");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kimi_current_tenant_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;
--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND a.attname = 'tenantId'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS kimi_tenant_isolation ON %I', r.table_name);
    EXECUTE format(
      'CREATE POLICY kimi_tenant_isolation ON %I FOR ALL USING (
         kimi_current_tenant_id() IS NULL
         OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
       ) WITH CHECK (
         kimi_current_tenant_id() IS NULL
         OR "tenantId" IS NOT DISTINCT FROM kimi_current_tenant_id()
       )',
      r.table_name
    );
  END LOOP;
END $$;
