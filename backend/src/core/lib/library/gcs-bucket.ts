/** GCS bucket name for chat/library uploads (safe to import from client-side type paths). */
export function uploadsBucketName() {
  const name =
    process.env.GCS_CHAT_UPLOADS_BUCKET?.trim() ||
    process.env.GCS_BUCKET?.trim();
  if (!name) {
    throw new Error(
      "Set GCS_CHAT_UPLOADS_BUCKET (or GCS_BUCKET) for library file storage"
    );
  }
  return name;
}
