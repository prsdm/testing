import type { DrivePermissionKind } from "@/core/lib/search/google-drive/external-access";

export type DrivePermissionRecord = {
  id: string;
  emailAddress: string | null;
  kind: DrivePermissionKind;
  domain: string | null;
  allowFileDiscovery: boolean | null;
  inheritedFromParent: string | null;
};

export function drivePermissionRecordFromApi(
  permission: Record<string, unknown>
): DrivePermissionRecord | null {
  const id = permission.id;
  const type = permission.type;
  if (typeof id !== "string" || typeof type !== "string") {
    return null;
  }
  if (
    type !== "user" &&
    type !== "group" &&
    type !== "domain" &&
    type !== "anyone"
  ) {
    return null;
  }

  const detailsList = permission.permissionDetails;
  const details =
    Array.isArray(detailsList) &&
    detailsList[0] &&
    typeof detailsList[0] === "object"
      ? (detailsList[0] as Record<string, unknown>)
      : null;
  const inheritedFrom = details?.inheritedFrom;

  return {
    allowFileDiscovery:
      typeof permission.allowFileDiscovery === "boolean"
        ? permission.allowFileDiscovery
        : null,
    domain: typeof permission.domain === "string" ? permission.domain : null,
    emailAddress:
      typeof permission.emailAddress === "string"
        ? permission.emailAddress
        : null,
    id,
    inheritedFromParent:
      typeof inheritedFrom === "string" ? inheritedFrom : null,
    kind: type,
  };
}
