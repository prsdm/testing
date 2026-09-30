CREATE TABLE IF NOT EXISTS "LibraryFile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenantId" uuid NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "chatId" uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "name" text NOT NULL,
  "contentType" text NOT NULL,
  "sizeBytes" integer NOT NULL,
  "pathname" text NOT NULL,
  "source" varchar(32) NOT NULL DEFAULT 'upload',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_file_tenant_user_created_idx" ON "LibraryFile" ("tenantId", "userId", "createdAt" DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_file_pathname_unique" ON "LibraryFile" ("pathname");
