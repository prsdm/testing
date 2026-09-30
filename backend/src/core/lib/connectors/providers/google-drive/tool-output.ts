import { driveConnectPath } from "./auth";
import {
  DriveActionNotAllowedError,
  DriveActionsDisabledError,
  DriveNotConnectedError,
} from "./errors";
import type { DriveToolErrorOutput } from "./types";

export function toDriveToolErrorOutput(
  error: unknown,
  tenantSlug: string
): DriveToolErrorOutput {
  if (error instanceof DriveNotConnectedError) {
    return {
      code: error.code,
      connectUrl: driveConnectPath(tenantSlug),
      error: error.message,
    };
  }
  if (error instanceof DriveActionsDisabledError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof DriveActionNotAllowedError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: "Drive action failed unexpectedly." };
}
