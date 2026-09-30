ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "embeddingModel" SET DEFAULT 'BAAI/bge-base-en-v1.5';

ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "embeddingDimension" SET DEFAULT 768;

ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "queryPrefix" SET DEFAULT 'Represent this sentence for searching relevant passages: ';

ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "passagePrefix" SET DEFAULT '';

UPDATE "TenantSearchSettings"
SET
  "embeddingModel" = 'BAAI/bge-base-en-v1.5',
  "embeddingDimension" = 768,
  "queryPrefix" = 'Represent this sentence for searching relevant passages: ',
  "passagePrefix" = '';
