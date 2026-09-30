export const CAPABILITY_IDS = [
  "admin.general",
  "admin.integrations",
  "admin.slack_integration",
  "admin.models",
  "admin.web_search",
  "admin.users",
  "admin.groups",
  "admin.roles",
  "admin.security",
  "admin.audit",
  "admin.billing",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export type CapabilityGroupId = "admin";

export type CapabilityDefinition = {
  id: CapabilityId;
  group: CapabilityGroupId;
  label: string;
  description: string;
};

export const CAPABILITY_CATALOG: CapabilityDefinition[] = [
  {
    description: "Access and manage General workspace settings.",
    group: "admin",
    id: "admin.general",
    label: "Manage workspace settings",
  },
  {
    description: "Enable, configure, and restrict workspace integrations.",
    group: "admin",
    id: "admin.integrations",
    label: "Manage integrations",
  },
  {
    description:
      "Install and configure the Kimiro Slack integration for the workspace.",
    group: "admin",
    id: "admin.slack_integration",
    label: "Manage Slack integration",
  },
  {
    description: "Add providers, API keys, and default models.",
    group: "admin",
    id: "admin.models",
    label: "Manage models",
  },
  {
    description: "Configure web search providers for the workspace.",
    group: "admin",
    id: "admin.web_search",
    label: "Manage web search",
  },
  {
    description: "View members, change Admin/Basic, and assign custom roles.",
    group: "admin",
    id: "admin.users",
    label: "Manage users",
  },
  {
    description: "Create groups and manage group membership.",
    group: "admin",
    id: "admin.groups",
    label: "Manage groups",
  },
  {
    description: "Create and edit custom roles and their capabilities.",
    group: "admin",
    id: "admin.roles",
    label: "Manage roles",
  },
  {
    description: "View SSO status, login domains, and access policies.",
    group: "admin",
    id: "admin.security",
    label: "Manage security & SSO",
  },
  {
    description: "Review security and admin activity for the workspace.",
    group: "admin",
    id: "admin.audit",
    label: "View audit log",
  },
  {
    description: "See plan allowance and estimated AI usage for the workspace.",
    group: "admin",
    id: "admin.billing",
    label: "View billing & usage",
  },
];

export const CAPABILITY_GROUPS: Array<{
  id: CapabilityGroupId;
  label: string;
}> = [{ id: "admin", label: "Admin" }];

/** Default pack for Basic members (before custom roles). */
export const BASIC_DEFAULT_CAPABILITIES: readonly CapabilityId[] = [] as const;

export const ADMIN_NAV_CAPABILITY_BY_SEGMENT: Record<string, CapabilityId> = {
  audit: "admin.audit",
  billing: "admin.billing",
  general: "admin.general",
  groups: "admin.groups",
  integrations: "admin.integrations",
  models: "admin.models",
  roles: "admin.roles",
  security: "admin.security",
  "slack-integration": "admin.slack_integration",
  users: "admin.users",
  "web-search": "admin.web_search",
};

export function isCapabilityId(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as readonly string[]).includes(value);
}

export function isAdminCapability(capability: CapabilityId) {
  return capability.startsWith("admin.");
}

export function hasCapability(
  capabilities: ReadonlySet<CapabilityId> | readonly CapabilityId[],
  capability: CapabilityId
) {
  return new Set(capabilities).has(capability);
}

export function hasAnyAdminCapability(
  capabilities: ReadonlySet<CapabilityId> | readonly CapabilityId[]
) {
  return [...capabilities].some((capability) => isAdminCapability(capability));
}

export function resolveCapabilitiesFromParts({
  isFullAdmin,
  hasCustomRole = false,
  customCapabilities,
}: {
  isFullAdmin: boolean;
  /** When true, use only customCapabilities (no Basic defaults). */
  hasCustomRole?: boolean;
  customCapabilities: readonly CapabilityId[];
}): Set<CapabilityId> {
  if (isFullAdmin) {
    return new Set(CAPABILITY_IDS);
  }

  if (hasCustomRole) {
    return new Set(customCapabilities);
  }

  return new Set(BASIC_DEFAULT_CAPABILITIES);
}
