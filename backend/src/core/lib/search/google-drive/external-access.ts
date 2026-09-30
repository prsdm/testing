import { prefixExternalGroup, prefixUserEmail } from "../acl";
import { PUBLIC_DOC_PAT } from "../constants";

export type DrivePermissionKind = "user" | "group" | "domain" | "anyone";

export type DrivePermission = {
  id: string;
  type: DrivePermissionKind;
  emailAddress?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
  permissionDetails?: Array<{
    inheritedFrom?: string;
    role?: string;
    type?: string;
  }>;
};

export type DriveFileForAccess = {
  id: string;
  owners?: Array<{ emailAddress?: string }>;
  permissions?: DrivePermission[];
  permissionIds?: string[];
  driveId?: string;
};

function normalizeEmail(email: string | undefined) {
  if (!email?.trim()) {
    return "";
  }
  return email.trim().toLowerCase();
}

function ownerEmails(file: DriveFileForAccess) {
  const emails = new Set<string>();
  for (const owner of file.owners ?? []) {
    if (owner.emailAddress) {
      emails.add(normalizeEmail(owner.emailAddress));
    }
  }
  return emails;
}

export function buildExtGroupNameForDrive(groupId: string) {
  return `google_drive_${groupId}`.toLowerCase();
}

export function externalAccessToAcl(input: {
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

export function getExternalAccessFromDriveFile(
  file: DriveFileForAccess,
  companyDomain: string
) {
  const userEmails = ownerEmails(file);
  const groupIds = new Set<string>();
  let isPublic = false;

  for (const permission of file.permissions ?? []) {
    const inheritedFrom = permission.permissionDetails?.[0]?.inheritedFrom;
    if (inheritedFrom) {
      groupIds.add(inheritedFrom);
    }

    if (permission.type === "user" && permission.emailAddress) {
      const email = normalizeEmail(permission.emailAddress);
      if (email) {
        userEmails.add(email);
      }
    } else if (permission.type === "group" && permission.emailAddress) {
      const groupKey = normalizeEmail(permission.emailAddress);
      if (groupKey) {
        groupIds.add(groupKey);
      }
    } else if (
      permission.type === "domain" &&
      permission.domain === companyDomain
    ) {
      isPublic = true;
    } else if (permission.type === "anyone") {
      isPublic = true;
    }
  }

  if (file.driveId) {
    groupIds.add(file.driveId);
  }

  return externalAccessToAcl({
    groupIds,
    isPublic,
    userEmails,
  });
}
