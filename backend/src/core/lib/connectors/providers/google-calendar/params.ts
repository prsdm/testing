import type { ToolParam } from "@/core/lib/connectors/providers/types";

export const GOOGLE_CALENDAR_PARAMS: Record<string, ToolParam[]> = {
  googleCalendarCreateEvent: [
    {
      description: 'Calendar id (default "primary")',
      name: "calendarId",
      required: false,
      type: "string",
    },
    {
      description: "Event title",
      name: "summary",
      required: true,
      type: "string",
    },
    {
      description: "Event description",
      name: "description",
      required: false,
      type: "string",
    },
    {
      description: "Event location",
      name: "location",
      required: false,
      type: "string",
    },
    {
      description:
        "Local start time (YYYY-MM-DDTHH:mm:ss). Do not add UTC offsets.",
      name: "startDateTime",
      required: false,
      type: "string",
    },
    {
      description:
        "Local end time (YYYY-MM-DDTHH:mm:ss). Do not add UTC offsets.",
      name: "endDateTime",
      required: false,
      type: "string",
    },
    {
      description: "All-day event start date (YYYY-MM-DD)",
      name: "startDate",
      required: false,
      type: "string",
    },
    {
      description: "All-day event end date (YYYY-MM-DD, exclusive)",
      name: "endDate",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional IANA timezone. Defaults to the target calendar timezone (use that for user-local times).",
      name: "timeZone",
      required: false,
      type: "string",
    },
    {
      description:
        "Comma-separated attendee email addresses. Calendar invite emails are sent to each guest.",
      name: "attendees",
      required: false,
      type: "string",
    },
  ],
  googleCalendarDeleteEvent: [
    {
      description: 'Calendar id (default "primary")',
      name: "calendarId",
      required: false,
      type: "string",
    },
    {
      description: "Event id to delete",
      name: "eventId",
      required: true,
      type: "string",
    },
  ],
  googleCalendarGetEvent: [
    {
      description: 'Calendar id (default "primary")',
      name: "calendarId",
      required: false,
      type: "string",
    },
    {
      description: "Event id from a prior list-events result",
      name: "eventId",
      required: true,
      type: "string",
    },
  ],
  googleCalendarListCalendars: [
    {
      description: "Maximum calendars to return (1–50, default 25)",
      name: "maxResults",
      required: false,
      type: "number",
    },
    {
      description:
        "Pagination token from a prior googleCalendarListCalendars result",
      name: "pageToken",
      required: false,
      type: "string",
    },
  ],
  googleCalendarListEvents: [
    {
      description: 'Calendar id (default "primary")',
      name: "calendarId",
      required: false,
      type: "string",
    },
    {
      description:
        "Lower bound (RFC3339 with timezone offset, e.g. 2026-06-22T00:00:00Z). Omit to use now.",
      name: "timeMin",
      required: false,
      type: "string",
    },
    {
      description:
        "Upper bound (RFC3339 with timezone offset). Omit to use 7 days from now.",
      name: "timeMax",
      required: false,
      type: "string",
    },
    {
      description: "Free-text search over event fields",
      name: "query",
      required: false,
      type: "string",
    },
    {
      description: "Maximum events to return (1–50, default 25)",
      name: "maxResults",
      required: false,
      type: "number",
    },
    {
      description:
        "Pagination token from a prior googleCalendarListEvents result",
      name: "pageToken",
      required: false,
      type: "string",
    },
  ],
  googleCalendarUpdateEvent: [
    {
      description: 'Calendar id (default "primary")',
      name: "calendarId",
      required: false,
      type: "string",
    },
    {
      description: "Event id to update",
      name: "eventId",
      required: true,
      type: "string",
    },
    {
      description: "Updated event title",
      name: "summary",
      required: false,
      type: "string",
    },
    {
      description: "Updated event description",
      name: "description",
      required: false,
      type: "string",
    },
    {
      description: "Updated event location",
      name: "location",
      required: false,
      type: "string",
    },
    {
      description:
        "Updated local start time (YYYY-MM-DDTHH:mm:ss). Do not add UTC offsets.",
      name: "startDateTime",
      required: false,
      type: "string",
    },
    {
      description:
        "Updated local end time (YYYY-MM-DDTHH:mm:ss). Do not add UTC offsets.",
      name: "endDateTime",
      required: false,
      type: "string",
    },
    {
      description: "Updated all-day start date (YYYY-MM-DD)",
      name: "startDate",
      required: false,
      type: "string",
    },
    {
      description: "Updated all-day end date (YYYY-MM-DD, exclusive)",
      name: "endDate",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional IANA timezone. Defaults to the target calendar timezone.",
      name: "timeZone",
      required: false,
      type: "string",
    },
    {
      description:
        "Comma-separated attendee email addresses. Calendar invite emails are sent to each guest.",
      name: "attendees",
      required: false,
      type: "string",
    },
  ],
};
