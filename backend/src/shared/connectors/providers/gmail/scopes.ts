/** OAuth scopes for per-user Gmail chat actions. */
export const GMAIL_ACTION_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const DEFAULT_GMAIL_OAUTH_SCOPES = [...GMAIL_ACTION_SCOPES] as const;
