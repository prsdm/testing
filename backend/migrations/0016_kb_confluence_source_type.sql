DO $$ BEGIN
  ALTER TYPE "kb_source_type" ADD VALUE IF NOT EXISTS 'confluence';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
