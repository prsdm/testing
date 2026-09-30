import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { getDriveAccessTokenForUser } from "./drive-auth";
import type { DrivePermissionRecord } from "./drive-permission-record";
import { drivePermissionRecordFromApi } from "./drive-permission-record";
import { paginateDriveApi } from "./google-paginate";
import type { DriveMembershipGroup } from "./membership-types";
import { fetchDrivePermissionsByIds } from "./permission-fetch";
import { listAllWorkspaceUserEmails } from "./workspace-users";

const DRIVE_FOLDER_TYPE = "application/vnd.google-apps.folder";
const MAX_USER_FAILURE_RATE = 0.5;

const FOLDER_LIST_FIELDS =
  "nextPageToken,files(id,name,permissionIds,permissions(id,emailAddress,type,domain,allowFileDiscovery,permissionDetails))";

type DriveFolderFile = {
  id?: string;
  permissionIds?: string[];
  permissions?: Record<string, unknown>[];
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function listWorkspaceFoldersForUser(input: {
  accessToken: string;
}): Promise<DriveFolderFile[]> {
  const query = `mimeType = '${DRIVE_FOLDER_TYPE}' and trashed = false`;
  return paginateDriveApi<DriveFolderFile>({
    accessToken: input.accessToken,
    buildPath: (pageToken) => {
      const params = new URLSearchParams({
        corpora: "allDrives",
        fields: FOLDER_LIST_FIELDS,
        includeItemsFromAllDrives: "true",
        includePermissionsForView: "published",
        pageSize: "100",
        q: query,
        supportsAllDrives: "true",
        ...(pageToken ? { pageToken } : {}),
      });
      return `/files?${params.toString()}`;
    },
    continueOn403404: true,
    listKey: "files",
  });
}

function folderPermissionRecords(input: {
  folder: DriveFolderFile;
  accessToken: string;
}): Promise<DrivePermissionRecord[]> {
  const folderId = input.folder.id;
  if (!folderId) {
    return Promise.resolve([]);
  }
  const inline = input.folder.permissions ?? [];
  if (inline.length > 0) {
    const records: DrivePermissionRecord[] = [];
    for (const permission of inline) {
      const record = drivePermissionRecordFromApi(permission);
      if (record) {
        records.push(record);
      }
    }
    return Promise.resolve(records);
  }
  const permissionIds = input.folder.permissionIds ?? [];
  if (permissionIds.length === 0) {
    return Promise.resolve([]);
  }
  return fetchDrivePermissionsByIds({
    accessToken: input.accessToken,
    fileId: folderId,
    permissionIds,
  });
}

function membershipGroupFromFolder(input: {
  folderId: string;
  permissions: DrivePermissionRecord[];
  workspaceGroupIndex: Record<string, Set<string>>;
}): DriveMembershipGroup | null {
  if (input.permissions.length === 0) {
    return null;
  }

  let grantsPublic = false;
  const members = new Set<string>();

  for (const permission of input.permissions) {
    if (permission.inheritedFromParent) {
      continue;
    }
    if (permission.kind === "user" && permission.emailAddress) {
      members.add(normalizeEmail(permission.emailAddress));
    } else if (permission.kind === "group" && permission.emailAddress) {
      const key = normalizeEmail(permission.emailAddress);
      const groupMembers = input.workspaceGroupIndex[key];
      if (groupMembers) {
        for (const member of groupMembers) {
          members.add(member);
        }
      }
    } else if (permission.kind === "anyone") {
      grantsPublic = true;
    }
  }

  if (members.size === 0 && !grantsPublic) {
    return null;
  }

  return {
    grantsPublicAccess: grantsPublic,
    memberEmails: [...members].sort(),
    resourceId: input.folderId,
  };
}

/** Collect folder membership groups. */
export async function collectFolderMembershipGroups(input: {
  credentials: ProviderDirectoryCredentials;
  googleDomain: string;
  workspaceGroupIndex: Record<string, Set<string>>;
}): Promise<DriveMembershipGroup[]> {
  const seenFolderIds = new Set<string>();
  const groups: DriveMembershipGroup[] = [];
  let failedUsers = 0;
  const userEmails = await listAllWorkspaceUserEmails({
    credentials: input.credentials,
    googleDomain: input.googleDomain,
  });

  for (const userEmail of userEmails) {
    try {
      const accessToken = await getDriveAccessTokenForUser(
        input.credentials,
        userEmail
      );
      const folders = await listWorkspaceFoldersForUser({ accessToken });
      for (const folder of folders) {
        const folderId = folder.id;
        if (!folderId || seenFolderIds.has(folderId)) {
          continue;
        }
        seenFolderIds.add(folderId);

        const allPerms = await folderPermissionRecords({
          accessToken,
          folder,
        });
        const directPerms = allPerms.filter(
          (permission) => permission.inheritedFromParent === null
        );
        const group = membershipGroupFromFolder({
          folderId,
          permissions: directPerms,
          workspaceGroupIndex: input.workspaceGroupIndex,
        });
        if (group) {
          groups.push(group);
        }
      }
    } catch {
      failedUsers += 1;
    }
  }

  if (
    userEmails.length > 0 &&
    failedUsers > MAX_USER_FAILURE_RATE * userEmails.length
  ) {
    throw new Error(
      `Too many folder membership failures (${failedUsers}/${userEmails.length})`
    );
  }

  return groups;
}
