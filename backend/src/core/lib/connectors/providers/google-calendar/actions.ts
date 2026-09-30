import { googleCalendarFetch } from "@/core/lib/connectors/providers/google-calendar/api";
import { assertGoogleCalendarActionAllowed } from "@/core/lib/connectors/providers/google-calendar/auth";
import {
  buildEventBody,
  eventSendUpdatesQuery,
  fetchCalendarTimeZone,
  mapEventDetail,
  mapEventSummary,
  normalizeCalendarId,
  normalizeMaxResults,
  resolveListEventsTimeRange,
} from "@/core/lib/connectors/providers/google-calendar/event-utils";
import type { GoogleCalendarApiEvent } from "@/core/lib/connectors/providers/google-calendar/types";

type CalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    primary?: boolean;
    accessRole?: string;
    timeZone?: string;
  }>;
  nextPageToken?: string;
};

type EventsListResponse = {
  items?: GoogleCalendarApiEvent[];
  nextPageToken?: string;
  summary?: string;
  timeZone?: string;
};

export async function googleCalendarListCalendars(input: {
  tenantId: string;
  accessToken: string;
  maxResults?: number;
  pageToken?: string;
}) {
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const maxResults = normalizeMaxResults(input.maxResults, 25);
  const query = new URLSearchParams({
    maxResults: String(maxResults),
  });
  if (input.pageToken?.trim()) {
    query.set("pageToken", input.pageToken.trim());
  }

  const page = await googleCalendarFetch<CalendarListResponse>(
    input.accessToken,
    `/users/me/calendarList?${query.toString()}`
  );

  const calendars = (page.items ?? [])
    .map((calendar) => {
      const id = calendar.id?.trim() ?? "";
      return {
        accessRole: calendar.accessRole?.trim() || undefined,
        description: calendar.description?.trim() || undefined,
        id: id || undefined,
        primary: calendar.primary ?? false,
        summary: calendar.summary?.trim() || "(no name)",
        timeZone: calendar.timeZone?.trim() || undefined,
      };
    })
    .filter((calendar) => Boolean(calendar.id));

  const calendarCount = calendars.length;
  const summary =
    calendarCount === 0
      ? "No calendars found"
      : `${calendarCount} calendar${calendarCount === 1 ? "" : "s"}`;

  return {
    calendarCount,
    calendars,
    nextPageToken: page.nextPageToken?.trim() || undefined,
    summary,
  };
}

export async function googleCalendarListEvents(input: {
  tenantId: string;
  accessToken: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  query?: string;
  maxResults?: number;
  pageToken?: string;
}) {
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const calendarId = normalizeCalendarId(input.calendarId);
  const { timeMin, timeMax } = resolveListEventsTimeRange({
    timeMax: input.timeMax,
    timeMin: input.timeMin,
  });
  const maxResults = normalizeMaxResults(input.maxResults, 25);

  const query = new URLSearchParams({
    maxResults: String(maxResults),
    orderBy: "startTime",
    singleEvents: "true",
    timeMax,
    timeMin,
  });
  if (input.query?.trim()) {
    query.set("q", input.query.trim());
  }
  if (input.pageToken?.trim()) {
    query.set("pageToken", input.pageToken.trim());
  }

  const page = await googleCalendarFetch<EventsListResponse>(
    input.accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`
  );

  const events = (page.items ?? [])
    .filter((event) => event.status !== "cancelled")
    .map(mapEventSummary);
  const eventCount = events.length;
  const rangeLabel = `${timeMin.slice(0, 10)} → ${timeMax.slice(0, 10)}`;
  const summary =
    eventCount === 0
      ? `${calendarId} · no events (${rangeLabel})`
      : `${calendarId} · ${eventCount} event${eventCount === 1 ? "" : "s"} (${rangeLabel})`;

  return {
    calendarId,
    eventCount,
    events,
    nextPageToken: page.nextPageToken?.trim() || undefined,
    query: input.query?.trim() || undefined,
    summary,
    timeMax,
    timeMin,
  };
}

export async function googleCalendarGetEvent(input: {
  tenantId: string;
  accessToken: string;
  calendarId?: string;
  eventId: string;
}) {
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const calendarId = normalizeCalendarId(input.calendarId);
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const event = await googleCalendarFetch<GoogleCalendarApiEvent>(
    input.accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );

  return {
    calendarId,
    ...mapEventDetail(event),
  };
}

export async function googleCalendarCreateEvent(input: {
  tenantId: string;
  accessToken: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  attendees?: string;
}) {
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const calendarId = normalizeCalendarId(input.calendarId);
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("summary is required.");
  }

  const hasTimedEvent =
    Boolean(input.startDateTime?.trim()) && Boolean(input.endDateTime?.trim());
  const timeZone = hasTimedEvent
    ? input.timeZone?.trim() ||
      (await fetchCalendarTimeZone(input.accessToken, calendarId))
    : input.timeZone?.trim();

  const body = buildEventBody({
    attendees: input.attendees,
    description: input.description,
    endDate: input.endDate,
    endDateTime: input.endDateTime,
    location: input.location,
    startDate: input.startDate,
    startDateTime: input.startDateTime,
    summary,
    timeZone,
  });

  if (!body.start || !body.end) {
    throw new Error(
      "Provide startDateTime and endDateTime for timed events, or startDate and endDate for all-day events."
    );
  }

  const created = await googleCalendarFetch<GoogleCalendarApiEvent>(
    input.accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events${eventSendUpdatesQuery(body)}`,
    {
      body: JSON.stringify(body),
      method: "POST",
    }
  );

  const inviteEmailsSent = Boolean(body.attendees);

  return {
    calendarId,
    inviteEmailsSent,
    timeZone: timeZone || created.start?.timeZone?.trim() || undefined,
    ...mapEventDetail(created),
  };
}

export async function googleCalendarUpdateEvent(input: {
  tenantId: string;
  accessToken: string;
  calendarId?: string;
  eventId: string;
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
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const calendarId = normalizeCalendarId(input.calendarId);
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  const hasTimedUpdate =
    Boolean(input.startDateTime?.trim()) || Boolean(input.endDateTime?.trim());
  const timeZone = hasTimedUpdate
    ? input.timeZone?.trim() ||
      (await fetchCalendarTimeZone(input.accessToken, calendarId))
    : input.timeZone?.trim();

  const body = buildEventBody({
    attendees: input.attendees,
    description: input.description,
    endDate: input.endDate,
    endDateTime: input.endDateTime,
    location: input.location,
    startDate: input.startDate,
    startDateTime: input.startDateTime,
    summary: input.summary,
    timeZone,
  });

  if (Object.keys(body).length === 0) {
    throw new Error("Provide at least one field to update.");
  }

  const updated = await googleCalendarFetch<GoogleCalendarApiEvent>(
    input.accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      body: JSON.stringify(body),
      method: "PATCH",
    }
  );

  return {
    calendarId,
    inviteEmailsSent: Boolean(body.attendees),
    timeZone: timeZone || updated.start?.timeZone?.trim() || undefined,
    ...mapEventDetail(updated),
  };
}

export async function googleCalendarDeleteEvent(input: {
  tenantId: string;
  accessToken: string;
  calendarId?: string;
  eventId: string;
}) {
  await assertGoogleCalendarActionAllowed({ tenantId: input.tenantId });

  const calendarId = normalizeCalendarId(input.calendarId);
  const eventId = input.eventId.trim();
  if (!eventId) {
    throw new Error("eventId is required.");
  }

  await googleCalendarFetch<Record<string, never>>(
    input.accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );

  return {
    calendarId,
    deleted: true,
    eventId,
    summary: `Deleted event ${eventId}`,
  };
}
