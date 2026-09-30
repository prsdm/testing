import { ensureFreshGoogleDriveAccessToken } from "@/core/lib/connectors/providers/google-drive/credential-token";
import {
  type GoogleCalendarToolId,
  isGoogleCalendarToolId,
} from "@/shared/connectors/providers/google-calendar/chat-tools";
import {
  googleCalendarCreateEvent,
  googleCalendarDeleteEvent,
  googleCalendarGetEvent,
  googleCalendarListCalendars,
  googleCalendarListEvents,
  googleCalendarUpdateEvent,
} from "./actions";
import { toGoogleCalendarToolErrorOutput } from "./tool-output";

export type { GoogleCalendarToolId } from "@/shared/connectors/providers/google-calendar/chat-tools";
export {
  GOOGLE_CALENDAR_ACTION_TOOL_IDS,
  GOOGLE_CALENDAR_TOOL_IDS,
  googleCalendarToolIdsForConnector,
  isGoogleCalendarToolId,
} from "@/shared/connectors/providers/google-calendar/chat-tools";

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function optionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
}

export async function executeGoogleCalendar(
  toolId: GoogleCalendarToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");

  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Google Calendar connection context is incomplete." };
  }

  if (!isGoogleCalendarToolId(toolId)) {
    return { error: `Unsupported Google Calendar tool: ${toolId}` };
  }

  try {
    const accessToken = await ensureFreshGoogleDriveAccessToken({
      credentialId,
      tenantId,
      userId,
    });

    if (toolId === "googleCalendarListCalendars") {
      return await googleCalendarListCalendars({
        accessToken,
        maxResults: optionalNumber(merged.maxResults),
        pageToken: optionalString(merged.pageToken),
        tenantId,
      });
    }

    if (toolId === "googleCalendarListEvents") {
      return await googleCalendarListEvents({
        accessToken,
        calendarId: optionalString(merged.calendarId),
        maxResults: optionalNumber(merged.maxResults),
        pageToken: optionalString(merged.pageToken),
        query: optionalString(merged.query),
        tenantId,
        timeMax: optionalString(merged.timeMax),
        timeMin: optionalString(merged.timeMin),
      });
    }

    if (toolId === "googleCalendarGetEvent") {
      return await googleCalendarGetEvent({
        accessToken,
        calendarId: optionalString(merged.calendarId),
        eventId: String(merged.eventId ?? ""),
        tenantId,
      });
    }

    if (toolId === "googleCalendarCreateEvent") {
      return await googleCalendarCreateEvent({
        accessToken,
        attendees: optionalString(merged.attendees),
        calendarId: optionalString(merged.calendarId),
        description: optionalString(merged.description),
        endDate: optionalString(merged.endDate),
        endDateTime: optionalString(merged.endDateTime),
        location: optionalString(merged.location),
        startDate: optionalString(merged.startDate),
        startDateTime: optionalString(merged.startDateTime),
        summary: String(merged.summary ?? ""),
        tenantId,
        timeZone: optionalString(merged.timeZone),
      });
    }

    if (toolId === "googleCalendarUpdateEvent") {
      return await googleCalendarUpdateEvent({
        accessToken,
        attendees: optionalString(merged.attendees),
        calendarId: optionalString(merged.calendarId),
        description: optionalString(merged.description),
        endDate: optionalString(merged.endDate),
        endDateTime: optionalString(merged.endDateTime),
        eventId: String(merged.eventId ?? ""),
        location: optionalString(merged.location),
        startDate: optionalString(merged.startDate),
        startDateTime: optionalString(merged.startDateTime),
        summary: optionalString(merged.summary),
        tenantId,
        timeZone: optionalString(merged.timeZone),
      });
    }

    if (toolId === "googleCalendarDeleteEvent") {
      return await googleCalendarDeleteEvent({
        accessToken,
        calendarId: optionalString(merged.calendarId),
        eventId: String(merged.eventId ?? ""),
        tenantId,
      });
    }

    return { error: `Unsupported Google Calendar tool: ${toolId}` };
  } catch (error) {
    return toGoogleCalendarToolErrorOutput(error, tenantSlug);
  }
}
