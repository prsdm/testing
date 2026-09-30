export type GoogleCalendarToolErrorOutput = {
  error: string;
  code?: string;
  connectUrl?: string;
};

export type GoogleCalendarEventTime = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type GoogleCalendarApiEvent = {
  id?: string;
  status?: string;
  htmlLink?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventTime;
  end?: GoogleCalendarEventTime;
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string };
  creator?: { email?: string; displayName?: string };
};
