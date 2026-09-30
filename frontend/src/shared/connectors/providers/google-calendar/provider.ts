import type { Provider } from "@/shared/connectors/provider-types";
import { DEFAULT_GOOGLE_CALENDAR_OAUTH_SCOPES } from "./scopes";

export const GOOGLE_CALENDAR_PROVIDER_ID = "google-calendar";

export const googleCalendarProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Communication",
  description:
    "Connect your Google account to view, create, update, and delete calendar events from chat.",
  iconColor: "bg-blue-600",
  id: GOOGLE_CALENDAR_PROVIDER_ID,
  name: "Google Calendar",
  scopes: [...DEFAULT_GOOGLE_CALENDAR_OAUTH_SCOPES],
  tools: [
    {
      description:
        "List calendars the user can access. Use before listing events when the user names a specific calendar.",
      id: "googleCalendarListCalendars",
      name: "List Google calendars",
    },
    {
      description:
        "List upcoming events from a calendar (default primary). Supports timeMin, timeMax, and free-text query. Omit timeMin/timeMax for the default next 7 days — do not pass date strings without a timezone offset. Use when the user explicitly wants calendar-only results.",
      id: "googleCalendarListEvents",
      name: "List Google Calendar events",
    },
    {
      description:
        "Read full details for one event by eventId from a prior list-events result.",
      id: "googleCalendarGetEvent",
      name: "Get Google Calendar event",
    },
    {
      description:
        "Create a timed event with startDateTime/endDateTime (local clock times, e.g. 2026-06-23T10:00:00) or an all-day event with startDate/endDate. Times use the target calendar timezone automatically. Guest emails receive calendar invites when attendees are included.",
      id: "googleCalendarCreateEvent",
      name: "Create Google Calendar event",
    },
    {
      description:
        "Update an existing event by eventId. Only include fields that should change.",
      id: "googleCalendarUpdateEvent",
      name: "Update Google Calendar event",
    },
    {
      description:
        "Delete an event by eventId from a prior list or get result.",
      id: "googleCalendarDeleteEvent",
      name: "Delete Google Calendar event",
    },
  ],
};
