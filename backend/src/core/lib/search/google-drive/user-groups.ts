import { JWT } from "google-auth-library";
import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { GOOGLE_DRIVE_INDEX_SCOPES } from "./scopes";

function createWorkspaceJwtClient(credentials: ProviderDirectoryCredentials) {
  if (
    !credentials.serviceAccountClientEmail ||
    !credentials.serviceAccountPrivateKey ||
    !credentials.delegatedAdminEmail
  ) {
    return null;
  }
  return new JWT({
    email: credentials.serviceAccountClientEmail,
    key: credentials.serviceAccountPrivateKey.replaceAll("\\n", "\n"),
    scopes: [...GOOGLE_DRIVE_INDEX_SCOPES],
    subject: credentials.delegatedAdminEmail,
  });
}

/**
 * Lists Google Workspace groups the user belongs to (membership sync search path).
 * Returns raw group emails — prefix with buildExtGroupNameForDrive before ACL lookup.
 */
export async function listWorkspaceGroupEmailsForUser(
  credentials: ProviderDirectoryCredentials,
  userEmail: string
): Promise<string[]> {
  const client = createWorkspaceJwtClient(credentials);
  if (!client) {
    return [];
  }

  const tokenResponse = await client.authorize();
  if (!tokenResponse.access_token) {
    return [];
  }

  const groups: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      fields: "groups(email),nextPageToken",
      maxResults: "200",
      userKey: userEmail.trim().toLowerCase(),
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/groups?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      }
    );
    if (response.status === 403 || response.status === 404) {
      return groups;
    }
    if (!response.ok) {
      return groups;
    }
    const payload = (await response.json()) as {
      groups?: Array<{ email?: string }>;
      nextPageToken?: string;
    };
    for (const group of payload.groups ?? []) {
      if (typeof group.email === "string" && group.email.trim()) {
        groups.push(group.email.trim().toLowerCase());
      }
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return groups;
}
