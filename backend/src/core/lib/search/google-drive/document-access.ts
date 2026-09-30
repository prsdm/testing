import { prefixExternalGroup, prefixUserEmail } from "@/core/lib/search/acl";
import { PUBLIC_DOC_PAT } from "@/core/lib/search/constants";
import {
  buildExtGroupNameForDrive,
  type DriveFileForAccess,
} from "@/core/lib/search/google-drive/external-access";
import type { DrivePermissionRecord } from "./drive-permission-record";
import {
  fetchDrivePermissionsByIds,
  mergeDrivePermissionRecords,
} from "./permission-fetch";

function normalizeEmail(email: string | null | undefined) {
  if (!email?.trim()) {
    return "";
  }
  return email.trim().toLowerCase();
}

function ownerEmails(file: DriveFileForAccess) {
  const emails = new Set<string>();
  for (const owner of file.owners ?? []) {
    const email = normalizeEmail(owner.emailAddress);
    if (email) {
      emails.add(email);
    }
  }
  return emails;
}

function permissionsFromInline(
  permissions: DriveFileForAccess["permissions"]
): DrivePermissionRecord[] {
  if (!permissions?.length) {
    return [];
  }
  return permissions.map((permission) => {
    const inheritedFrom = permission.permissionDetails?.[0]?.inheritedFrom;
    return {
      allowFileDiscovery: permission.allowFileDiscovery ?? null,
      domain: permission.domain ?? null,
      emailAddress: permission.emailAddress ?? null,
      id: permission.id,
      inheritedFromParent:
        typeof inheritedFrom === "string" ? inheritedFrom : null,
      kind: permission.type,
    };
  });
}

function externalAccessToAcl(input: {
  userEmails: Set<string>;
  groupIds: Set<string>;
  isPublic: boolean;
}) {
  const acl = new Set<string>();
  for (const email of input.userEmails) {
    acl.add(prefixUserEmail(email));
  }
  for (const groupId of input.groupIds) {
    acl.add(prefixExternalGroup(buildExtGroupNameForDrive(groupId)));
  }
  if (input.isPublic) {
    acl.add(PUBLIC_DOC_PAT);
  }
  return [...acl];
}

/**
 * External access for a Drive file (indexing path uses prefixed groups).
 */
export async function getExternalAccessAclForDriveFile(input: {
  file: DriveFileForAccess;
  companyDomain: string;
  accessToken: string;
  fallbackUserEmail: string;
}): Promise<string[]> {
  const docId = input.file.id;
  if (!docId) {
    throw new Error("Drive file missing id");
  }

  let permissionsList = permissionsFromInline(input.file.permissions);

  if (permissionsList.length === 0 && input.file.permissionIds?.length) {
    permissionsList = await fetchDrivePermissionsByIds({
      accessToken: input.accessToken,
      fileId: docId,
      permissionIds: input.file.permissionIds,
    });
  }

  if (permissionsList.length === 0) {
    const owners = ownerEmails(input.file);
    const fallback = normalizeEmail(input.fallbackUserEmail);
    const userEmails =
      owners.size > 0
        ? owners
        : fallback
          ? new Set([fallback])
          : new Set<string>();
    return externalAccessToAcl({
      groupIds: new Set(),
      isPublic: false,
      userEmails,
    });
  }

  const parentFolderIds = new Set<string>();
  const userEmails = ownerEmails(input.file);
  const groupEmails = new Set<string>();
  let isPublic = false;
  const companyDomain = input.companyDomain.trim().toLowerCase();

  for (const permission of permissionsList) {
    if (permission.inheritedFromParent) {
      parentFolderIds.add(permission.inheritedFromParent);
    }

    if (permission.kind === "user") {
      const email = normalizeEmail(permission.emailAddress);
      if (email) {
        userEmails.add(email);
      }
    } else if (permission.kind === "group") {
      const email = normalizeEmail(permission.emailAddress);
      if (email) {
        groupEmails.add(email);
      }
    } else if (permission.kind === "domain" && companyDomain) {
      if (permission.domain === companyDomain) {
        isPublic = true;
      }
    } else if (permission.kind === "anyone") {
      isPublic = true;
    }
  }

  const groupIds = new Set<string>([
    ...groupEmails,
    ...parentFolderIds,
    ...(input.file.driveId ? [input.file.driveId] : []),
  ]);

  return externalAccessToAcl({ groupIds, isPublic, userEmails });
}

/** Re-fetch permissions with a second pass if inline list was partial. */
export async function getExternalAccessAclForDriveFileWithRetry(input: {
  file: DriveFileForAccess;
  companyDomain: string;
  accessToken: string;
  fallbackUserEmail: string;
}): Promise<string[]> {
  const inline = permissionsFromInline(input.file.permissions);
  const expectedCount = input.file.permissionIds?.length ?? inline.length;

  if (
    input.file.permissionIds?.length &&
    inline.length < input.file.permissionIds.length
  ) {
    const fetched = await fetchDrivePermissionsByIds({
      accessToken: input.accessToken,
      fileId: input.file.id,
      permissionIds: input.file.permissionIds,
    });
    const merged = mergeDrivePermissionRecords([inline, fetched]);
    return getExternalAccessAclForDriveFile({
      ...input,
      file: {
        ...input.file,
        permissionIds: undefined,
        permissions: merged.map((p) => ({
          allowFileDiscovery: p.allowFileDiscovery ?? undefined,
          domain: p.domain ?? undefined,
          emailAddress: p.emailAddress ?? undefined,
          id: p.id,
          permissionDetails: p.inheritedFromParent
            ? [{ inheritedFrom: p.inheritedFromParent }]
            : undefined,
          type: p.kind,
        })),
      },
    });
  }

  if (expectedCount === 0 && inline.length === 0) {
    return getExternalAccessAclForDriveFile(input);
  }

  return getExternalAccessAclForDriveFile(input);
}
