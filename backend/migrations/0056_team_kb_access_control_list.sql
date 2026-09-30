ALTER TABLE "TeamKbItem"
  ADD COLUMN IF NOT EXISTS "accessControlList" text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "TeamKbItem_access_control_list_gin_idx"
  ON "TeamKbItem" USING GIN ("accessControlList");
