export function matchesAllowedOrgUnits(args: {
  allowedOrgUnits: string[];
  personOrgUnit: string | null;
}): boolean {
  if (args.allowedOrgUnits.length === 0) {
    return true;
  }
  const personOrgUnit = args.personOrgUnit;
  if (!personOrgUnit) {
    return false;
  }
  return args.allowedOrgUnits.some((prefix) =>
    personOrgUnit.startsWith(prefix)
  );
}

export type TenantAccessDenial =
  | "inactive_person"
  | "inactive_member"
  | "org_unit"
  | null;

export function evaluateTenantAccess(args: {
  personStatus?: string | null;
  memberAllowed: boolean;
  allowedOrgUnits: string[];
  personOrgUnit: string | null;
}): TenantAccessDenial {
  if (args.personStatus === "inactive") {
    return "inactive_person";
  }
  if (!args.memberAllowed) {
    return "inactive_member";
  }
  if (!matchesAllowedOrgUnits(args)) {
    return "org_unit";
  }
  return null;
}
