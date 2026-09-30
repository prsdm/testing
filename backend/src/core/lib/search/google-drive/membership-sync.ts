import {
  markTenantDriveExternalGroupsStale,
  removeStaleTenantDriveExternalGroups,
  tenantDriveMembershipRowCount,
  upsertTenantDriveResourceMembershipGroups,
  upsertTenantDriveUserGoogleGroupMemberships,
} from "@/core/lib/db/drive-membership-queries";
import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { buildExtGroupNameForDrive } from "@/core/lib/search/google-drive/external-access";
import { getAdminDirectoryAccessToken } from "./drive-auth";
import { collectFolderMembershipGroups } from "./folder-membership";
import { paginateAdminDirectory } from "./google-paginate";
import type { DriveMembershipGroup } from "./membership-types";
import { collectSharedDriveMembershipGroups } from "./shared-drive-membership";
import { buildWorkspaceGroupMemberIndex } from "./workspace-group-index";
import { listAllWorkspaceUserEmails } from "./workspace-users";

function membershipGroupsToStored(groups: DriveMembershipGroup[]) {
  return groups.map((group) => ({
    externalGroupId: buildExtGroupNameForDrive(group.resourceId),
    grantsPublicAccess: group.grantsPublicAccess,
    memberEmails: group.memberEmails,
  }));
}

async function syncWorkspaceGroupsForUsers(input: {
  tenantId: string;
  credentials: ProviderDirectoryCredentials;
  workspaceEmails: string[];
}) {
  const accessToken = await getAdminDirectoryAccessToken(input.credentials);
  let synced = 0;

  for (const userEmail of input.workspaceEmails) {
    try {
      const groups = await paginateAdminDirectory<{ email?: string }>({
        accessToken,
        buildUrl: (pageToken) => {
          const params = new URLSearchParams({
            fields: "groups(email),nextPageToken",
            maxResults: "200",
            userKey: userEmail,
            ...(pageToken ? { pageToken } : {}),
          });
          return `https://admin.googleapis.com/admin/directory/v1/groups?${params.toString()}`;
        },
        continueOn403404: true,
        listKey: "groups",
      });

      const groupIds = groups
        .map((group) => group.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
        .map((email) => buildExtGroupNameForDrive(email));

      await upsertTenantDriveUserGoogleGroupMemberships({
        externalGroupIds: groupIds,
        tenantId: input.tenantId,
        userEmail,
      });
      synced += 1;
    } catch {
      // Log 403/404 and continue per user
    }
  }

  return synced;
}

export type DriveMembershipSyncResult = {
  syncedUsers: number;
  resourceGroups: number;
  membershipRows: number;
};

/**
 * Sync Google Drive group memberships for a tenant.
 */
export async function syncTenantDriveMemberships(input: {
  tenantId: string;
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
}): Promise<DriveMembershipSyncResult> {
  const googleDomain = input.googleDomain.trim().toLowerCase();
  if (!googleDomain) {
    throw new Error("Google domain is required for Drive membership sync");
  }

  await markTenantDriveExternalGroupsStale(input.tenantId);

  const workspaceEmails = await listAllWorkspaceUserEmails({
    credentials: input.credentials,
    googleDomain,
  });

  const syncedUsers = await syncWorkspaceGroupsForUsers({
    credentials: input.credentials,
    tenantId: input.tenantId,
    workspaceEmails,
  });

  const workspaceGroupIndex = await buildWorkspaceGroupMemberIndex({
    credentials: input.credentials,
    googleDomain,
  });

  const resourceGroups = [
    ...(await collectFolderMembershipGroups({
      credentials: input.credentials,
      googleDomain,
      workspaceGroupIndex,
    })),
    ...(await collectSharedDriveMembershipGroups({
      credentials: input.credentials,
      googleDomain,
      workspaceGroupIndex,
    })),
  ];

  await upsertTenantDriveResourceMembershipGroups({
    membershipGroups: membershipGroupsToStored(resourceGroups),
    tenantId: input.tenantId,
  });

  await removeStaleTenantDriveExternalGroups(input.tenantId);

  const membershipRows = await tenantDriveMembershipRowCount(input.tenantId);

  return {
    membershipRows,
    resourceGroups: resourceGroups.length,
    syncedUsers,
  };
}
