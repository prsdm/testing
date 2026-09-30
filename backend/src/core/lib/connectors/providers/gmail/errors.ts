export class GmailActionsDisabledError extends Error {
  readonly code = "GMAIL_ACTIONS_DISABLED";

  constructor() {
    super("Gmail actions are not enabled for this workspace.");
    this.name = "GmailActionsDisabledError";
  }
}

export class GmailActionNotAllowedError extends Error {
  readonly code = "GMAIL_ACTION_NOT_ALLOWED";

  constructor(message: string) {
    super(message);
    this.name = "GmailActionNotAllowedError";
  }
}
