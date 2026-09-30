export const ADMIN_BOOTSTRAP_PAGES = [
  "general",
  "integrations",
  "mcp",
  "integration-detail",
  "slack-integration",
  "models",
  "web-search",
  "users",
  "groups",
  "groups-new",
  "group-detail",
  "roles",
  "security",
  "audit",
  "analytics",
  "billing",
] as const;

export type AdminBootstrapPage = (typeof ADMIN_BOOTSTRAP_PAGES)[number];
