import { googleCalendarFetch } from "@/core/lib/connectors/providers/google-calendar/api";
import type { GoogleCalendarApiEvent } from "./types";

export function normalizeCalendarId(calendarId?: string) {
  const trimmed = calendarId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "primary";
}

export function normalizeMaxResults(
  value: number | undefined,
  fallback: number
) {
  return Math.min(Math.max(value ?? fallback, 1), 50);
}

function formatEventWhen(event: GoogleCalendarApiEvent) {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start) {
    return;
  }
  if (end) {
    return `${start} → ${end}`;
  }
  return start;
}

export function mapEventSummary(event: GoogleCalendarApiEvent) {
  const id = event.id?.trim() ?? "";
  const attendees = (event.attendees ?? [])
    .map((attendee) => attendee.email?.trim() || "")
    .filter((value) => value.length > 0);

  return {
    attendees: attendees.length > 0 ? attendees : undefined,
    id: id || undefined,
    link: event.htmlLink?.trim() || undefined,
    location: event.location?.trim() || undefined,
    status: event.status?.trim() || undefined,
    summary: event.summary?.trim() || "(no title)",
    when: formatEventWhen(event),
  };
}

export function mapEventDetail(event: GoogleCalendarApiEvent) {
  const attendees = (event.attendees ?? [])
    .map((attendee) => attendee.email?.trim())
    .filter((email): email is string => Boolean(email));

  return {
    ...mapEventSummary(event),
    attendees: attendees.length > 0 ? attendees : undefined,
    description: event.description?.trim() || undefined,
    end: event.end,
    organizer: event.organizer?.email?.trim() || undefined,
    start: event.start,
  };
}

/** Keep clock time (10:00) and drop any model-supplied UTC offset. */
export function stripDateTimeToLocalParts(dateTime: string) {
  const trimmed = dateTime.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
  if (!match) {
    return trimmed;
  }
  return match[1];
}

export async function fetchCalendarTimeZone(
  accessToken: string,
  calendarId: string
) {
  const calendar = await googleCalendarFetch<{ timeZone?: string }>(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}`
  );
  const timeZone = calendar.timeZone?.trim();
  if (!timeZone) {
    throw new Error(`Could not resolve timezone for calendar ${calendarId}.`);
  }
  return timeZone;
}

function parseAttendees(value?: string) {
  if (!value?.trim()) {
    return;
  }
  const emails = value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  if (emails.length === 0) {
    return;
  }
  return emails.map((email) => ({ email }));
}

export function buildEventBody(input: {
  summary?: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  attendees?: string;
}) {
  const body: Record<string, unknown> = {};

  if (input.summary?.trim()) {
    body.summary = input.summary.trim();
  }
  if (input.description?.trim()) {
    body.description = input.description.trim();
  }
  if (input.location?.trim()) {
    body.location = input.location.trim();
  }

  const timeZone = input.timeZone?.trim();
  const startDate = input.startDate?.trim();
  const endDate = input.endDate?.trim();
  const startDateTime = input.startDateTime?.trim();
  const endDateTime = input.endDateTime?.trim();

  if (startDate && endDate) {
    body.start = { date: startDate };
    body.end = { date: endDate };
  } else if (startDateTime && endDateTime) {
    if (!timeZone) {
      throw new Error("timeZone is required for timed events.");
    }
    body.start = {
      dateTime: stripDateTimeToLocalParts(startDateTime),
      timeZone,
    };
    body.end = {
      dateTime: stripDateTimeToLocalParts(endDateTime),
      timeZone,
    };
  }

  const attendees = parseAttendees(input.attendees);
  if (attendees) {
    body.attendees = attendees;
  }

  return body;
}

export function eventSendUpdatesQuery(body: Record<string, unknown>) {
  const attendees = body.attendees;
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return "";
  }
  return "?sendUpdates=all";
}

export function defaultListEventsTimeRange() {
  const timeMin = new Date();
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + 7);
  return {
    timeMax: timeMax.toISOString(),
    timeMin: timeMin.toISOString(),
  };
}

const CALENDAR_API_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_API_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_API_NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function parseCalendarInstant(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Google Calendar requires RFC3339 with a timezone offset (or Z). */
export function normalizeCalendarApiDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (CALENDAR_API_DATE_TIME.test(trimmed)) {
    return trimmed;
  }
  if (CALENDAR_API_DATE.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }
  if (CALENDAR_API_NAIVE_DATE_TIME.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    return `${withSeconds}Z`;
  }
  return null;
}

export function resolveListEventsTimeRange(input: {
  timeMin?: string;
  timeMax?: string;
}) {
  const fallback = defaultListEventsTimeRange();
  const normalizedMin = input.timeMin?.trim()
    ? normalizeCalendarApiDateTime(input.timeMin)
    : null;
  const normalizedMax = input.timeMax?.trim()
    ? normalizeCalendarApiDateTime(input.timeMax)
    : null;

  const timeMin = normalizedMin ?? fallback.timeMin;
  let timeMax = normalizedMax ?? fallback.timeMax;

  if (CALENDAR_API_DATE.test(input.timeMax?.trim() ?? "")) {
    const endDate = new Date(`${input.timeMax?.trim()}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    timeMax = endDate.toISOString();
  }

  const minMs = parseCalendarInstant(timeMin);
  const maxMs = parseCalendarInstant(timeMax);
  if (minMs === null || maxMs === null || minMs >= maxMs) {
    return fallback;
  }

  return { timeMax, timeMin };
}
