ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "embeddingModel" SET DEFAULT 'BAAI/bge-m3';

ALTER TABLE "TenantSearchSettings"
  ALTER COLUMN "embeddingDimension" SET DEFAULT 1024;

UPDATE "TenantSearchSettings"
SET
  "embeddingModel" = 'BAAI/bge-m3',
  "embeddingDimension" = 1024,
  "queryPrefix" = 'Represent this sentence for searching relevant passages: ',
  "passagePrefix" = '';
