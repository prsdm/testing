export function formatAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "auth.session.created": "Signed in",
    "auth.session.deleted": "Signed out",
    "security.sensitive.denied_stale_session": "Blocked stale session",
    "security.sensitive.denied_unauthenticated": "Blocked sensitive action",
    "tenant.admin.groups.create": "Created group",
    "tenant.admin.groups.delete": "Deleted group",
    "tenant.admin.groups.members.add": "Added group members",
    "tenant.admin.groups.members.remove": "Removed group member",
    "tenant.admin.groups.update": "Updated group",
    "tenant.admin.models.provider.deleted": "Removed model provider",
    "tenant.admin.models.provider.updated": "Updated model provider",
    "tenant.admin.models.updated": "Updated models settings",
    "tenant.admin.roles.create": "Created role",
    "tenant.admin.roles.delete": "Deleted role",
    "tenant.admin.roles.update": "Updated role",
    "tenant.admin.security.access_policy.updated": "Updated access policy",
    "tenant.admin.security.domains.add": "Added login domain",
    "tenant.admin.security.domains.remove": "Removed login domain",
    "tenant.admin.slack_bot.disconnected": "Disconnected Slack integration",
    "tenant.admin.slack_bot.updated": "Updated Slack integration settings",
    "tenant.admin.slack_integration.disconnected":
      "Disconnected Slack integration",
    "tenant.admin.slack_integration.updated":
      "Updated Slack integration settings",
    "tenant.admin.web_search.deleted": "Removed web search provider",
    "tenant.admin.web_search.updated": "Updated web search",
    "tenant.general.logo.removed": "Removed workspace logo",
    "tenant.general.logo.updated": "Updated workspace logo",
    "tenant.general.updated": "Updated general settings",
    "tenant.integrations.confluence_actions.updated":
      "Updated Confluence actions",
    "tenant.integrations.connection.removed": "Removed integration connection",
    "tenant.integrations.drive_actions.updated": "Updated Drive actions",
    "tenant.integrations.index.triggered": "Triggered indexing",
    "tenant.integrations.jira_actions.updated": "Updated Jira actions",
    "tenant.integrations.notion_actions.updated": "Updated Notion actions",
    "tenant.integrations.service_account_key.uploaded":
      "Uploaded service account key",
    "tenant.integrations.settings.updated": "Updated integration settings",
    "tenant.integrations.setup.removed": "Removed integration setup",
    "tenant.integrations.setup.saved": "Saved integration setup",
    "tenant.integrations.sharepoint_actions.updated":
      "Updated SharePoint actions",
    "tenant.integrations.slack_actions.updated": "Updated Slack actions",
    "tenant.integrations.sync_memberships.triggered": "Synced memberships",
    "tenant.member.updated": "Updated member",
    "tenant.admin.mcp_server.created": "Created MCP server",
    "tenant.admin.mcp_server.updated": "Updated MCP server",
    "tenant.admin.mcp_server.deleted": "Deleted MCP server",
  };

  return labels[action] ?? action;
}
