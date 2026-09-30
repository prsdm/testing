CREATE TABLE IF NOT EXISTS "TenantIntegrationAvailability" (
  "tenantId" uuid NOT NULL,
  "integrationKey" varchar(64) NOT NULL,
  "isEnabled" boolean DEFAULT false NOT NULL,
  "availabilityMode" varchar(16) DEFAULT 'everyone' NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "TenantIntegrationAvailability_tenantId_integrationKey_pk" PRIMARY KEY ("tenantId", "integrationKey"),
  CONSTRAINT "TenantIntegrationAvailability_tenantId_Tenant_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "TenantIntegrationMember" (
  "tenantId" uuid NOT NULL,
  "integrationKey" varchar(64) NOT NULL,
  "memberId" uuid NOT NULL,
  CONSTRAINT "TenantIntegrationMember_tenantId_integrationKey_memberId_pk" PRIMARY KEY ("tenantId", "integrationKey", "memberId"),
  CONSTRAINT "TenantIntegrationMember_memberId_TenantMember_id_fk" FOREIGN KEY ("memberId") REFERENCES "public"."TenantMember"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "TenantIntegrationMember_tenant_integration_fk" FOREIGN KEY ("tenantId", "integrationKey") REFERENCES "public"."TenantIntegrationAvailability"("tenantId", "integrationKey") ON DELETE cascade ON UPDATE no action
);
