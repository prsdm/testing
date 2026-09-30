DO $$
BEGIN
  ALTER TYPE kb_source_type ADD VALUE IF NOT EXISTS 'slack';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
