/** Google Calendar action tools (unified Google OAuth with Drive/Docs/Gmail). */
export const GOOGLE_CALENDAR_ACTION_TOOL_IDS = [
  "googleCalendarListCalendars",
  "googleCalendarListEvents",
  "googleCalendarGetEvent",
  "googleCalendarCreateEvent",
  "googleCalendarUpdateEvent",
  "googleCalendarDeleteEvent",
] as const;

export const GOOGLE_CALENDAR_TOOL_IDS = [
  ...GOOGLE_CALENDAR_ACTION_TOOL_IDS,
] as const;

export type GoogleCalendarToolId = (typeof GOOGLE_CALENDAR_TOOL_IDS)[number];

export function isGoogleCalendarToolId(
  toolId: string
): toolId is GoogleCalendarToolId {
  return (GOOGLE_CALENDAR_TOOL_IDS as readonly string[]).includes(toolId);
}

export function googleCalendarToolIdsForConnector(): string[] {
  return [...GOOGLE_CALENDAR_ACTION_TOOL_IDS];
}
