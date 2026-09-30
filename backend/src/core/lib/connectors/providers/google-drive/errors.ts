export class DriveNotConnectedError extends Error {
  readonly code = "DRIVE_NOT_CONNECTED" as const;

  constructor() {
    super("Connect Google Drive in Connectors to use Drive actions in chat.");
    this.name = "DriveNotConnectedError";
  }
}

export class DriveActionsDisabledError extends Error {
  readonly code = "DRIVE_ACTIONS_DISABLED" as const;

  constructor() {
    super("Drive actions are not enabled for this organization.");
    this.name = "DriveActionsDisabledError";
  }
}

export class DriveActionNotAllowedError extends Error {
  readonly code = "DRIVE_ACTION_NOT_ALLOWED" as const;

  constructor(action: string) {
    super(`Drive action "${action}" is not allowed for this organization.`);
    this.name = "DriveActionNotAllowedError";
  }
}
