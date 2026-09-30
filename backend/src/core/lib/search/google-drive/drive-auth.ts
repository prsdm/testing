import { JWT } from "google-auth-library";
import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { GOOGLE_DRIVE_INDEX_SCOPES } from "./scopes";

function driveJwt(credentials: ProviderDirectoryCredentials, subject: string) {
  if (
    !credentials.serviceAccountClientEmail ||
    !credentials.serviceAccountPrivateKey
  ) {
    throw new Error(
      "Google Drive requires service account credentials in People settings."
    );
  }
  return new JWT({
    email: credentials.serviceAccountClientEmail,
    key: credentials.serviceAccountPrivateKey.replaceAll("\\n", "\n"),
    scopes: [...GOOGLE_DRIVE_INDEX_SCOPES],
    subject,
  });
}

export async function getDriveAccessTokenForUser(
  credentials: ProviderDirectoryCredentials,
  userEmail: string
) {
  const client = driveJwt(credentials, userEmail.trim());
  const tokenResponse = await client.authorize();
  if (!tokenResponse.access_token) {
    throw new Error(`Failed to authorize Google Drive API for ${userEmail}`);
  }
  return tokenResponse.access_token;
}

export async function getAdminDirectoryAccessToken(
  credentials: ProviderDirectoryCredentials
) {
  if (!credentials.delegatedAdminEmail?.trim()) {
    throw new Error(
      "Delegated admin email is required for Google Workspace directory access."
    );
  }
  return await getDriveAccessTokenForUser(
    credentials,
    credentials.delegatedAdminEmail.trim()
  );
}
