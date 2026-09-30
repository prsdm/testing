import { googleCalendarListEvents } from "@/core/lib/connectors/providers/google-calendar/actions";
import { ensureFreshGoogleDriveAccessToken } from "@/core/lib/connectors/providers/google-drive/credential-token";
import { getGoogleAppConnectorForTenantUser } from "@/core/lib/connectors/providers/google-shared/queries";
import { FEDERATED_LIVE_LIMIT } from "./constants";
import { buildCalendarFederatedQuery } from "./live-query";
import { type FederatedSourceResult, federatedErrorMessage } from "./outcome";

/** Past + upcoming window so person/topic meetings are findable. */
const FEDERATED_CALENDAR_PAST_DAYS = 90;
const FEDERATED_CALENDAR_FUTURE_DAYS = 60;

function calendarFederatedTimeRange() {
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - FEDERATED_CALENDAR_PAST_DAYS);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + FEDERATED_CALENDAR_FUTURE_DAYS);
  return {
    timeMax: timeMax.toISOString(),
    timeMin: timeMin.toISOString(),
  };
}

function calendarDocumentId(args: {
  id?: string;
  when?: string;
  index: number;
}) {
  const id = args.id?.trim();
  if (id) {
    return `calendar:${id}`;
  }
  const when = args.when?.trim();
  if (when) {
    return `calendar:when:${when}:${args.index}`;
  }
  return `calendar:unknown:${args.index}`;
}

function calendarContent(args: {
  summary: string;
  when?: string;
  location?: string;
  status?: string;
  attendees?: string[];
}) {
  const attendeeLabel =
    args.attendees && args.attendees.length > 0
      ? args.attendees.slice(0, 12).join(", ")
      : null;
  const lines = [
    `Event: ${args.summary}`,
    args.when ? `When: ${args.when}` : null,
    args.location ? `Location: ${args.location}` : null,
    attendeeLabel ? `Attendees: ${attendeeLabel}` : null,
    args.status ? `Status: ${args.status}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function parseEventStart(when?: string): string | undefined {
  if (!when?.trim()) {
    return undefined;
  }
  const start = when.split("→")[0]?.trim();
  if (!start) {
    return undefined;
  }
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

/** Live Google Calendar search → ranked chunks. Empty on missing credential or API errors. */
export async function searchCalendarFederated(args: {
  tenantId: string;
  userId: string;
  query: string;
  limit?: number;
}): Promise<FederatedSourceResult> {
  const query = args.query.trim();
  if (!query) {
    return { results: [] };
  }

  // Owned Calendar only — shared org credentials must not search another calendar.
  const connector = await getGoogleAppConnectorForTenantUser({
    appId: "google-calendar",
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connector) {
    return {
      error: "Connect your own Google Calendar account for live search.",
      results: [],
    };
  }

  try {
    const accessToken = await ensureFreshGoogleDriveAccessToken({
      credentialId: connector.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    const { timeMin, timeMax } = calendarFederatedTimeRange();
    const result = await googleCalendarListEvents({
      accessToken,
      maxResults: Math.min(
        args.limit ?? FEDERATED_LIVE_LIMIT,
        FEDERATED_LIVE_LIMIT
      ),
      query: buildCalendarFederatedQuery(query),
      tenantId: args.tenantId,
      timeMax,
      timeMin,
    });

    const results = result.events.map((event, index) => {
      const summary = event.summary?.trim() || "(no title)";
      const content = calendarContent({
        attendees: event.attendees,
        location: event.location,
        status: event.status,
        summary,
        when: event.when,
      });
      return {
        blurb: content.slice(0, 240),
        chunkIndex: 0,
        content,
        documentId: calendarDocumentId({
          id: event.id,
          index,
          when: event.when,
        }),
        link: event.link?.trim() ?? "",
        score: 1 - index * 0.01,
        sourceType: "calendar" as const,
        title: summary,
        updatedAt: parseEventStart(event.when),
      };
    });

    return { results };
  } catch (error) {
    return {
      error: federatedErrorMessage("Calendar", error),
      results: [],
    };
  }
}
