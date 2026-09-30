ALTER TABLE "TeamSource" ADD COLUMN IF NOT EXISTS "projectId" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TeamSource" ADD CONSTRAINT "TeamSource_projectId_Project_id_fk"
   FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TeamSource_project_idx" ON "TeamSource" ("projectId");
--> statement-breakpoint
UPDATE "TeamSource" ts
SET "projectId" = ps."projectId"
FROM "ProjectSource" ps
WHERE ps."sourceItemId" = ts.id
  AND ts."projectId" IS NULL;
--> statement-breakpoint
ALTER TABLE "Project" DROP COLUMN IF EXISTS instructions;
