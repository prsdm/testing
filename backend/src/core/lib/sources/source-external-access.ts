import { prefixExternalGroup, prefixUserEmail } from "@/core/lib/search/acl";
import { PUBLIC_DOC_PAT } from "@/core/lib/search/constants";
import { buildExtGroupNameForDrive } from "@/core/lib/search/google-drive/external-access";
import type { SourceConnectorType } from "@/shared/sources/source-types";

export type SourceExternalAccess = {
  userEmails: string[];
  groupIds: string[];
  /** Any tenant member may access (space/site/workspace default). */
  isTenantPublic: boolean;
};

export function normalizeSourceEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildExtGroupNameForSource(
  sourceType: SourceConnectorType,
  groupId: string
) {
  const trimmed = groupId.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (sourceType === "drive") {
    return buildExtGroupNameForDrive(trimmed);
  }
  if (trimmed.startsWith(`${sourceType}_`)) {
    return trimmed;
  }
  return `${sourceType}_${trimmed}`;
}

export function parseSourceExternalAccess(
  value: unknown
): SourceExternalAccess | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const userEmails = Array.isArray(record.userEmails)
    ? [
        ...new Set(
          record.userEmails
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => normalizeSourceEmail(entry))
            .filter(Boolean)
        ),
      ]
    : [];
  const groupIds = Array.isArray(record.groupIds)
    ? [
        ...new Set(
          record.groupIds
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
        ),
      ]
    : [];
  const isTenantPublic = record.isTenantPublic === true;
  if (userEmails.length === 0 && groupIds.length === 0 && !isTenantPublic) {
    return null;
  }
  return { groupIds, isTenantPublic, userEmails };
}

export function sourceExternalAccessToAclTokens(args: {
  sourceType: SourceConnectorType;
  access: SourceExternalAccess;
  tenantId: string;
  ownerUserId?: string | null;
}) {
  const acl = new Set<string>();
  if (args.access.isTenantPublic) {
    acl.add(`tenant:${args.tenantId}`);
  }
  for (const email of args.access.userEmails) {
    acl.add(prefixUserEmail(email));
  }
  for (const groupId of args.access.groupIds) {
    const extName = buildExtGroupNameForSource(args.sourceType, groupId);
    if (extName) {
      acl.add(prefixExternalGroup(extName));
    }
  }
  if (args.access.isTenantPublic) {
    acl.add(PUBLIC_DOC_PAT);
  }
  if (args.ownerUserId) {
    acl.add(`user:${args.ownerUserId}`);
  }
  return [...acl];
}

export function tenantPublicSourceExternalAccess(): SourceExternalAccess {
  return {
    groupIds: [],
    isTenantPublic: true,
    userEmails: [],
  };
}

export function restrictedSourceExternalAccess(args: {
  userEmails: Iterable<string>;
  groupIds?: Iterable<string>;
}): SourceExternalAccess {
  return {
    groupIds: [
      ...new Set(
        [...(args.groupIds ?? [])]
          .map((groupId) => groupId.trim().toLowerCase())
          .filter(Boolean)
      ),
    ],
    isTenantPublic: false,
    userEmails: [
      ...new Set(
        [...args.userEmails]
          .map((email) => normalizeSourceEmail(email))
          .filter(Boolean)
      ),
    ],
  };
}

export function isResolvableSourceExternalAccess(
  access: SourceExternalAccess | null | undefined
): access is SourceExternalAccess {
  if (!access) {
    return false;
  }
  return (
    access.isTenantPublic ||
    access.userEmails.length > 0 ||
    access.groupIds.length > 0
  );
}

export function sourceExternalAccessEqual(
  left: SourceExternalAccess | null | undefined,
  right: SourceExternalAccess | null | undefined
) {
  const parsedLeft = left ? parseSourceExternalAccess(left) : null;
  const parsedRight = right ? parseSourceExternalAccess(right) : null;
  if (!parsedLeft || !parsedRight) {
    return parsedLeft === parsedRight;
  }
  if (parsedLeft.isTenantPublic !== parsedRight.isTenantPublic) {
    return false;
  }
  const leftEmails = [...parsedLeft.userEmails].sort().join("\0");
  const rightEmails = [...parsedRight.userEmails].sort().join("\0");
  if (leftEmails !== rightEmails) {
    return false;
  }
  const leftGroups = [...parsedLeft.groupIds].sort().join("\0");
  const rightGroups = [...parsedRight.groupIds].sort().join("\0");
  return leftGroups === rightGroups;
}

export function aclTokensToSourceExternalAccess(args: {
  sourceType: SourceConnectorType;
  tokens: string[];
}): SourceExternalAccess {
  const userEmails = new Set<string>();
  const groupIds = new Set<string>();
  let isTenantPublic = false;

  for (const token of args.tokens) {
    if (token === PUBLIC_DOC_PAT) {
      isTenantPublic = true;
      continue;
    }
    if (token.startsWith("user_email:")) {
      const email = normalizeSourceEmail(token.slice("user_email:".length));
      if (email) {
        userEmails.add(email);
      }
      continue;
    }
    if (token.startsWith("external_group:")) {
      const extName = token
        .slice("external_group:".length)
        .trim()
        .toLowerCase();
      if (!extName) {
        continue;
      }
      const prefix = `${args.sourceType}_`;
      if (extName.startsWith(prefix)) {
        groupIds.add(extName.slice(prefix.length));
      } else if (
        args.sourceType === "drive" &&
        extName.startsWith("google_drive_")
      ) {
        groupIds.add(extName.slice("google_drive_".length));
      } else {
        groupIds.add(extName);
      }
    }
  }

  return {
    groupIds: [...groupIds],
    isTenantPublic,
    userEmails: [...userEmails],
  };
}
