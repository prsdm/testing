DO $$
BEGIN
  ALTER TYPE "llm_provider_name" ADD VALUE IF NOT EXISTS 'google';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
