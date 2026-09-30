import { assertConnectorAccountMatchesUserEmail } from "@/core/lib/connectors/account-email-policy";
import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import {
  DriveActionNotAllowedError,
  DriveActionsDisabledError,
} from "./errors";

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch Google account profile.");
  }
  const payload = (await response.json()) as { email?: string };
  if (!payload.email?.trim()) {
    throw new Error("Google account email missing from profile.");
  }
  return payload.email.trim().toLowerCase();
}

export function assertGoogleAccountMatchesUserEmail(args: {
  googleAccountEmail: string;
  userEmail: string;
}) {
  assertConnectorAccountMatchesUserEmail({
    providerAccountEmail: args.googleAccountEmail,
    providerLabel: "Google account",
    userEmail: args.userEmail,
  });
}

export async function assertDriveActionAllowed(input: {
  tenantId: string;
  action: "read" | "create";
}) {
  const credentials = await getTenantDriveActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new DriveActionsDisabledError();
  }
  if (input.action === "read" && !credentials.settings.allowRead) {
    throw new DriveActionNotAllowedError("read");
  }
}

export function driveConnectPath(_tenantSlug: string) {
  return "/connectors";
}
