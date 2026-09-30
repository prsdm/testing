import { PUBLIC_DOC_PAT } from "./constants";
import { buildExtGroupNameForDrive } from "./google-drive/external-access";

export function prefixUserEmail(email: string) {
  return `user_email:${email.trim().toLowerCase()}`;
}

export function prefixExternalGroup(groupId: string) {
  return `external_group:${groupId}`;
}

function resolveExternalGroupName(groupId: string) {
  const trimmed = groupId.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("google_drive_")) {
    return trimmed;
  }
  return buildExtGroupNameForDrive(trimmed);
}

export function buildUserAclSet(input: {
  userEmail: string;
  /**
   * Raw group emails / folder ids, or stored prefixed ids (`google_drive_*`).
   */
  externalGroupIds?: string[];
  includePublic?: boolean;
}) {
  const acl = new Set<string>([prefixUserEmail(input.userEmail)]);
  for (const groupId of input.externalGroupIds ?? []) {
    const extName = resolveExternalGroupName(groupId);
    if (extName) {
      acl.add(prefixExternalGroup(extName));
    }
  }
  if (input.includePublic) {
    acl.add(PUBLIC_DOC_PAT);
  }
  return acl;
}
