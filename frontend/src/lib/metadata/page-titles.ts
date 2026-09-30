export const APP_TITLE = "Kimiro";

export function formatPageTitle(segment: string) {
  return `${APP_TITLE} — ${segment}`;
}

export const PAGE_TITLES = {
  adminAudit: "Audit log",
  adminBilling: "Billing",
  adminGeneral: "General",
  adminGroups: "Groups",
  adminIntegrations: "Integrations",
  adminModels: "Models",
  adminRoles: "Roles",
  adminSecurity: "Security",
  adminSlackIntegration: "Slack integration",
  adminUsers: "Users",
  adminWebSearch: "Web search",
  connectors: "Connectors",
  knowledgeBases: "Knowledge base",
  library: "Library",
  login: "Login",
  newChat: "New chat",
  setup: "Setup",
  sources: "Sources",
} as const;
