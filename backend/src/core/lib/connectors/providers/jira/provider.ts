import type { Provider } from "@/core/lib/connectors/providers/types";
import { DEFAULT_JIRA_OAUTH_SCOPES } from "./scopes";

export const JIRA_PROVIDER_ID = "jira";

export const jiraProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Project Management",
  description:
    "Connect Jira Cloud to search issues, read details, create and update work, transition status, and add comments from chat.",
  iconColor: "bg-[#0052CC]",
  id: JIRA_PROVIDER_ID,
  name: "Jira",
  scopes: [...DEFAULT_JIRA_OAUTH_SCOPES],
  tools: [
    {
      description:
        "List Jira projects accessible to the connected user. Use before create or JQL when project key is unknown.",
      id: "jiraListProjects",
      name: "List Jira projects",
    },
    {
      description:
        "Search issues with JQL. Use for assigned-to-me, open bugs, sprint, or project filters.",
      id: "jiraSearchIssues",
      name: "Search Jira issues",
    },
    {
      description: "Retrieve a Jira issue by key or id.",
      id: "jiraGetIssue",
      name: "Get Jira issue",
    },
    {
      description:
        "Create an issue in a project. Requires projectKey, summary, and issueType.",
      id: "jiraCreateIssue",
      name: "Create Jira issue",
    },
    {
      description: "Update summary and/or description on an existing issue.",
      id: "jiraUpdateIssue",
      name: "Update Jira issue",
    },
    {
      description:
        "List available workflow transitions for an issue. Call before jiraTransitionIssue.",
      id: "jiraListTransitions",
      name: "List Jira transitions",
    },
    {
      description:
        "Move an issue through a workflow transition using transitionId from jiraListTransitions.",
      id: "jiraTransitionIssue",
      name: "Transition Jira issue",
    },
    {
      description: "Add a comment to a Jira issue.",
      id: "jiraAddComment",
      name: "Add Jira comment",
    },
  ],
};
