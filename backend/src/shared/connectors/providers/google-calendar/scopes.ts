/** OAuth scopes for per-user Google Calendar chat actions. */
export const GOOGLE_CALENDAR_ACTION_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const DEFAULT_GOOGLE_CALENDAR_OAUTH_SCOPES = [
  ...GOOGLE_CALENDAR_ACTION_SCOPES,
] as const;
