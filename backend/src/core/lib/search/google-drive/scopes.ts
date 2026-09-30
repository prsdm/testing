/** Google OAuth scopes for Drive workspace indexing + ACL. */
export const GOOGLE_DRIVE_INDEX_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
] as const;
