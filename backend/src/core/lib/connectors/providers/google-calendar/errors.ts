export class GoogleCalendarActionsDisabledError extends Error {
  readonly code = "GOOGLE_CALENDAR_ACTIONS_DISABLED";

  constructor() {
    super("Google Calendar actions are not enabled for this workspace.");
    this.name = "GoogleCalendarActionsDisabledError";
  }
}

export class GoogleCalendarActionNotAllowedError extends Error {
  readonly code = "GOOGLE_CALENDAR_ACTION_NOT_ALLOWED";

  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarActionNotAllowedError";
  }
}
