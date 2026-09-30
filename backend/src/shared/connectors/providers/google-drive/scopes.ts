/** OAuth scopes for per-user Google Drive chat actions. */
export const GOOGLE_DRIVE_LIST_SCOPE = "https://www.googleapis.com/auth/drive";
export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export const GOOGLE_DRIVE_ACTION_SCOPES = [
  GOOGLE_DRIVE_LIST_SCOPE,
  GOOGLE_DRIVE_READONLY_SCOPE,
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const DEFAULT_GOOGLE_DRIVE_OAUTH_SCOPES = [
  ...GOOGLE_DRIVE_ACTION_SCOPES,
] as const;

export function googleDriveActionScopesString() {
  return GOOGLE_DRIVE_ACTION_SCOPES.join(" ");
}

/** True when scopes can list Drive files (drive.file alone is not enough). */
export function googleOAuthScopesAllowDriveList(
  scopeString: string | null | undefined
) {
  if (!scopeString?.trim()) {
    return false;
  }
  const scopes = new Set(
    scopeString
      .split(/[,\s]+/)
      .map((scope) => scope.trim())
      .filter(Boolean)
  );
  return (
    scopes.has(GOOGLE_DRIVE_LIST_SCOPE) ||
    scopes.has(GOOGLE_DRIVE_READONLY_SCOPE)
  );
}
