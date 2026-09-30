ALTER TABLE "Chat"
  RENAME COLUMN "threadTopicCatalog" TO "threadTagCatalog";

UPDATE "Message_v2"
SET metadata = (metadata::jsonb - 'threadTopics')
  || jsonb_build_object('threadTags', metadata::jsonb -> 'threadTopics')
WHERE metadata IS NOT NULL
  AND metadata::jsonb ? 'threadTopics';
