ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "sourceExternalAccess" jsonb;
