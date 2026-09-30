import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { getAdminDirectoryAccessToken } from "./drive-auth";
import { paginateAdminDirectory } from "./google-paginate";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * All workspace user emails for membership crawl.
 */
export async function listAllWorkspaceUserEmails(input: {
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
}): Promise<string[]> {
  const adminEmail = input.credentials.delegatedAdminEmail?.trim();
  if (!adminEmail) {
    return [];
  }

  const accessToken = await getAdminDirectoryAccessToken(input.credentials);
  const userEmails = [normalizeEmail(adminEmail)];
  const domain = input.googleDomain.trim().toLowerCase();

  for (const isAdmin of [true, false]) {
    const query = isAdmin ? "isAdmin=true" : "isAdmin=false";
    const users = await paginateAdminDirectory<{ primaryEmail?: string }>({
      accessToken,
      buildUrl: (pageToken) => {
        const params = new URLSearchParams({
          domain,
          fields: "users(primaryEmail),nextPageToken",
          maxResults: "500",
          query,
          ...(pageToken ? { pageToken } : {}),
        });
        return `https://admin.googleapis.com/admin/directory/v1/users?${params.toString()}`;
      },
      listKey: "users",
    });

    for (const user of users) {
      const email = user.primaryEmail;
      if (!email) {
        continue;
      }
      const normalized = normalizeEmail(email);
      if (!userEmails.includes(normalized)) {
        userEmails.push(normalized);
      }
    }
  }

  return userEmails;
}
