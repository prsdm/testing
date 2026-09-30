import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { getAdminDirectoryAccessToken } from "./drive-auth";
import { paginateAdminDirectory } from "./google-paginate";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Build workspace group member index. */
export async function buildWorkspaceGroupMemberIndex(input: {
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
}): Promise<Record<string, Set<string>>> {
  const accessToken = await getAdminDirectoryAccessToken(input.credentials);
  const domain = input.googleDomain.trim().toLowerCase();

  const groups = await paginateAdminDirectory<{ email?: string }>({
    accessToken,
    buildUrl: (pageToken) => {
      const params = new URLSearchParams({
        domain,
        fields: "groups(email),nextPageToken",
        maxResults: "200",
        ...(pageToken ? { pageToken } : {}),
      });
      return `https://admin.googleapis.com/admin/directory/v1/groups?${params.toString()}`;
    },
    listKey: "groups",
  });

  const groupEmails = new Set<string>();
  for (const group of groups) {
    if (group.email) {
      groupEmails.add(normalizeEmail(group.email));
    }
  }

  const index: Record<string, Set<string>> = {};
  for (const groupEmail of groupEmails) {
    const members = new Set<string>();
    const memberRows = await paginateAdminDirectory<{ email?: string }>({
      accessToken,
      buildUrl: (pageToken) => {
        const params = new URLSearchParams({
          fields: "members(email),nextPageToken",
          groupKey: groupEmail,
          maxResults: "200",
          ...(pageToken ? { pageToken } : {}),
        });
        return `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members?${params.toString()}`;
      },
      listKey: "members",
    });
    for (const member of memberRows) {
      if (member.email) {
        members.add(normalizeEmail(member.email));
      }
    }
    index[groupEmail] = members;
  }

  return index;
}
