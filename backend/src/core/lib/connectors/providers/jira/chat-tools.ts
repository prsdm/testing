export const JIRA_ACTION_TOOL_IDS = [
  "jiraListProjects",
  "jiraSearchIssues",
  "jiraGetIssue",
  "jiraCreateIssue",
  "jiraUpdateIssue",
  "jiraListTransitions",
  "jiraTransitionIssue",
  "jiraAddComment",
] as const;
export const JIRA_TOOL_IDS = [...JIRA_ACTION_TOOL_IDS] as const;

export function jiraToolIdsForConnector(): string[] {
  return [...JIRA_ACTION_TOOL_IDS];
}
