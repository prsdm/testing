import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import {
  getAdminDirectoryAccessToken,
  getDriveAccessTokenForUser,
} from "./drive-auth";
import { paginateDriveApi } from "./google-paginate";
import type { DriveMembershipGroup } from "./membership-types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function listAllSharedDriveIds(input: {
  credentials: ProviderDirectoryCredentials;
  adminEmail: string;
}) {
  const accessToken = await getDriveAccessTokenForUser(
    input.credentials,
    input.adminEmail
  );
  const drives = await paginateDriveApi<{ id?: string }>({
    accessToken,
    buildPath: (pageToken) => {
      const params = new URLSearchParams({
        fields: "drives(id),nextPageToken",
        pageSize: "100",
        useDomainAdminAccess: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      return `/drives?${params.toString()}`;
    },
    listKey: "drives",
  });
  const ids = new Set<string>();
  for (const drive of drives) {
    if (drive.id) {
      ids.add(drive.id);
    }
  }
  return ids;
}

/** Collect shared-drive membership groups. */
export async function collectSharedDriveMembershipGroups(input: {
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
  workspaceGroupIndex: Record<string, Set<string>>;
}): Promise<DriveMembershipGroup[]> {
  const adminEmail = input.credentials.delegatedAdminEmail?.trim();
  if (!adminEmail) {
    return [];
  }

  const adminAccessToken = await getAdminDirectoryAccessToken(
    input.credentials
  );
  const adminInfo = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(adminEmail)}`,
    { headers: { Authorization: `Bearer ${adminAccessToken}` } }
  );
  if (adminInfo.status === 403) {
    throw new Error(
      `Admin ${adminEmail} cannot access Directory API for shared drive membership sync`
    );
  }
  if (!adminInfo.ok) {
    throw new Error(
      `Failed to load admin user profile (${adminInfo.status}) for shared drive sync`
    );
  }
  const adminPayload = (await adminInfo.json()) as {
    isAdmin?: boolean;
    isDelegatedAdmin?: boolean;
  };
  const isAdmin =
    adminPayload.isAdmin === true || adminPayload.isDelegatedAdmin === true;

  const driveAccessToken = await getDriveAccessTokenForUser(
    input.credentials,
    adminEmail
  );
  const driveIds = await listAllSharedDriveIds({
    adminEmail,
    credentials: input.credentials,
  });

  const groups: DriveMembershipGroup[] = [];
  for (const driveId of driveIds) {
    const members = new Set<string>();
    const driveGroupEmails = new Set<string>();

    const permissions = await paginateDriveApi<{
      type?: string;
      emailAddress?: string;
    }>({
      accessToken: driveAccessToken,
      buildPath: (pageToken) => {
        const params = new URLSearchParams({
          fields: "permissions(emailAddress,type),nextPageToken",
          fileId: driveId,
          pageSize: "100",
          supportsAllDrives: "true",
          useDomainAdminAccess: String(isAdmin),
          ...(pageToken ? { pageToken } : {}),
        });
        return `/files/${encodeURIComponent(driveId)}/permissions?${params.toString()}`;
      },
      continueOn403404: true,
      listKey: "permissions",
    });

    for (const permission of permissions) {
      if (permission.type === "group" && permission.emailAddress) {
        driveGroupEmails.add(normalizeEmail(permission.emailAddress));
      } else if (permission.type === "user" && permission.emailAddress) {
        members.add(normalizeEmail(permission.emailAddress));
      }
    }

    for (const groupEmail of driveGroupEmails) {
      const groupMembers = input.workspaceGroupIndex[groupEmail];
      if (groupMembers) {
        for (const member of groupMembers) {
          members.add(member);
        }
      }
    }

    if (members.size > 0) {
      groups.push({
        memberEmails: [...members].sort(),
        resourceId: driveId,
      });
    }
  }

  return groups;
}
