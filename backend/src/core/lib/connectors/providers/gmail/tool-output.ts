import { gmailConnectPath } from "./auth";
import {
  GmailActionNotAllowedError,
  GmailActionsDisabledError,
} from "./errors";
import type { GmailToolErrorOutput } from "./types";

export function toGmailToolErrorOutput(
  error: unknown,
  tenantSlug: string
): GmailToolErrorOutput {
  if (error instanceof GmailActionsDisabledError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof GmailActionNotAllowedError) {
    return {
      code: error.code,
      error: error.message,
    };
  }
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    const needsReconnect =
      lower.includes("insufficient") ||
      lower.includes("permission") ||
      lower.includes("403") ||
      lower.includes("401");
    if (needsReconnect) {
      return {
        connectUrl: gmailConnectPath(tenantSlug),
        error:
          "Gmail permission is missing on your Google token. Reconnect Gmail in Sources and approve mail access.",
      };
    }
    return { error: error.message };
  }
  return { error: "Gmail action failed unexpectedly." };
}
