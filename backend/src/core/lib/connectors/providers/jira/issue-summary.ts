type JiraIssueFields = {
  summary?: string;
  status?: { name?: string };
  assignee?: { displayName?: string };
  issuetype?: { name?: string };
};

export function buildJiraIssueBrowseUrl(args: {
  siteUrl: string;
  issueKey: string;
}) {
  const site = args.siteUrl.trim().replace(/\/+$/, "");
  return `${site}/browse/${encodeURIComponent(args.issueKey)}`;
}

export function summarizeJiraIssue(issue: {
  key?: string;
  fields?: JiraIssueFields;
}) {
  const key = issue.key?.trim() ?? "";
  const summary = issue.fields?.summary?.trim() ?? "";
  if (key && summary) {
    return `${key}: ${summary}`;
  }
  return key || summary || "Issue";
}

export function normalizeJiraIssue(issue: {
  id?: string;
  key?: string;
  self?: string;
  fields?: JiraIssueFields;
}) {
  return {
    assignee: issue.fields?.assignee?.displayName,
    id: issue.id,
    issueType: issue.fields?.issuetype?.name,
    key: issue.key,
    self: issue.self,
    status: issue.fields?.status?.name,
    summary: issue.fields?.summary,
  };
}
