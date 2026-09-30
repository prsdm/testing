import type { ToolParam } from "@/core/lib/connectors/providers/types";

const ISSUE_ID_OR_KEY_PARAM: ToolParam = {
  description: 'Jira issue key or id (for example "PROJ-123")',
  name: "issueIdOrKey",
  required: true,
  type: "string",
};

export const JIRA_PARAMS: Record<string, ToolParam[]> = {
  jiraAddComment: [
    ISSUE_ID_OR_KEY_PARAM,
    {
      description: "Comment text to add to the issue",
      name: "body",
      required: true,
      type: "string",
    },
  ],
  jiraCreateIssue: [
    {
      description:
        'Project key (for example "PROJ"). Use jiraListProjects first.',
      name: "projectKey",
      required: true,
      type: "string",
    },
    {
      description: "Issue summary/title",
      name: "summary",
      required: true,
      type: "string",
    },
    {
      description: 'Issue type name (for example "Task", "Bug", "Story")',
      name: "issueType",
      required: true,
      type: "string",
    },
    {
      description: "Optional issue description",
      name: "description",
      required: false,
      type: "string",
    },
  ],
  jiraGetIssue: [
    ISSUE_ID_OR_KEY_PARAM,
    {
      description:
        "Optional comma-separated Jira fields to return (defaults to summary, description, status, assignee, issuetype, priority, created, updated)",
      name: "fields",
      required: false,
      type: "string",
    },
  ],
  jiraListProjects: [
    {
      description: "Filter projects by name or key",
      name: "query",
      required: false,
      type: "string",
    },
    {
      description: "Pagination offset (default 0)",
      name: "startAt",
      required: false,
      type: "number",
    },
    {
      description: "Maximum projects to return (1–50, default 50)",
      name: "maxResults",
      required: false,
      type: "number",
    },
  ],
  jiraListTransitions: [ISSUE_ID_OR_KEY_PARAM],
  jiraSearchIssues: [
    {
      description:
        'JQL query (for example "project = PROJ AND status = \\"In Progress\\"")',
      name: "jql",
      required: true,
      type: "string",
    },
    {
      description: "Pagination offset (default 0)",
      name: "startAt",
      required: false,
      type: "number",
    },
    {
      description: "Maximum issues to return (1–100, default 25)",
      name: "maxResults",
      required: false,
      type: "number",
    },
  ],
  jiraTransitionIssue: [
    ISSUE_ID_OR_KEY_PARAM,
    {
      description: 'Transition id from jiraListTransitions (for example "31")',
      name: "transitionId",
      required: true,
      type: "string",
    },
  ],
  jiraUpdateIssue: [
    ISSUE_ID_OR_KEY_PARAM,
    {
      description: "Updated issue summary",
      name: "summary",
      required: false,
      type: "string",
    },
    {
      description: "Updated issue description",
      name: "description",
      required: false,
      type: "string",
    },
  ],
};
