import { googleCalendarConnectPath } from "./auth";
import {
  GoogleCalendarActionNotAllowedError,
  GoogleCalendarActionsDisabledError,
} from "./errors";
import type { GoogleCalendarToolErrorOutput } from "./types";

export function toGoogleCalendarToolErrorOutput(
  error: unknown,
  tenantSlug: string
): GoogleCalendarToolErrorOutput {
  if (error instanceof GoogleCalendarActionsDisabledError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof GoogleCalendarActionNotAllowedError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof Error) {
    const needsReconnect =
      error.message.includes("insufficient") ||
      error.message.includes("403") ||
      error.message.includes("401");
    if (needsReconnect) {
      return {
        connectUrl: googleCalendarConnectPath(tenantSlug),
        error: error.message,
      };
    }
    return { error: error.message };
  }
  return { error: "Google Calendar action failed unexpectedly." };
}
