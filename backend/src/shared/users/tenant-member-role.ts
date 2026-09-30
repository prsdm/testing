export const TENANT_MEMBER_ROLES = ["admin", "basic"] as const;

export type TenantMemberRole = (typeof TENANT_MEMBER_ROLES)[number];

export const DEFAULT_TENANT_MEMBER_ROLE: TenantMemberRole = "basic";
