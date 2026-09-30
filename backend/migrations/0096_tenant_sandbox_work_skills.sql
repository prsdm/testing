ALTER TABLE "TenantGeneralSettings" ADD COLUMN IF NOT EXISTS "sandboxWorkSkillsEnabled" jsonb DEFAULT '{"slides":true,"xlsx":true}'::jsonb NOT NULL;
