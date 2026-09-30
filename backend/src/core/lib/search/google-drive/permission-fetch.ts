import type { DrivePermissionRecord } from "./drive-permission-record";
import { drivePermissionRecordFromApi } from "./drive-permission-record";

async function driveFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
) {
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (response.status === 404 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Google Drive API ${path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

export async function fetchDrivePermissionsByIds(input: {
  accessToken: string;
  fileId: string;
  permissionIds: string[];
}): Promise<DrivePermissionRecord[]> {
  if (input.permissionIds.length === 0) {
    return [];
  }

  const permissionIdSet = new Set(input.permissionIds);
  const collected: DrivePermissionRecord[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      fields:
        "nextPageToken,permissions(id,emailAddress,type,domain,allowFileDiscovery,permissionDetails)",
      pageSize: "100",
      supportsAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await driveFetch(
      `/files/${encodeURIComponent(input.fileId)}/permissions?${params.toString()}`,
      input.accessToken
    );
    if (!response) {
      break;
    }

    const payload = (await response.json()) as {
      permissions?: Record<string, unknown>[];
      nextPageToken?: string;
    };

    for (const raw of payload.permissions ?? []) {
      const record = drivePermissionRecordFromApi(raw);
      if (record && permissionIdSet.has(record.id)) {
        collected.push(record);
      }
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return collected;
}

export function mergeDrivePermissionRecords(
  lists: DrivePermissionRecord[][]
): DrivePermissionRecord[] {
  const seen = new Set<string>();
  const merged: DrivePermissionRecord[] = [];
  for (const list of lists) {
    for (const permission of list) {
      if (!seen.has(permission.id)) {
        seen.add(permission.id);
        merged.push(permission);
      }
    }
  }
  return merged;
}
