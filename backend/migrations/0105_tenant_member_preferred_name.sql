ALTER TABLE "TenantMember"
  ADD COLUMN IF NOT EXISTS "preferredName" varchar(255);
