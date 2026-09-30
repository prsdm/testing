import { plainTextAdf } from "@/core/lib/connectors/providers/jira/adf";
import { jiraFetch } from "@/core/lib/connectors/providers/jira/api";
import { assertJiraActionAllowed } from "@/core/lib/connectors/providers/jira/auth";

export async function jiraListProjects(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  query?: string;
  startAt?: number;
  maxResults?: number;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const maxResults = Math.min(Math.max(input.maxResults ?? 50, 1), 50);
  const startAt = Math.max(input.startAt ?? 0, 0);
  const { data } = await jiraFetch<{
    values?: Array<{ id?: string; key?: string; name?: string }>;
    total?: number;
    isLast?: boolean;
  }>({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    path: "/rest/api/3/project/search",
    query: {
      maxResults,
      startAt,
      ...(input.query?.trim() ? { query: input.query.trim() } : {}),
    },
  });

  const projects = (data?.values ?? [])
    .filter((project) => project.id && project.key)
    .map((project) => ({
      id: project.id,
      key: project.key,
      name: project.name?.trim() || project.key,
    }));

  return {
    isLast: Boolean(data?.isLast),
    projects,
    summary: `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    total: data?.total ?? projects.length,
  };
}

export async function jiraSearchIssues(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  jql: string;
  maxResults?: number;
  startAt?: number;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const jql = input.jql.trim();
  if (!jql) {
    throw new Error("jql is required.");
  }

  const maxResults = Math.min(Math.max(input.maxResults ?? 25, 1), 100);
  const startAt = Math.max(input.startAt ?? 0, 0);
  const { data } = await jiraFetch<{
    issues?: Array<{
      id?: string;
      key?: string;
      fields?: {
        summary?: string;
        status?: { name?: string };
        assignee?: { displayName?: string };
      };
    }>;
    total?: number;
    nextPageToken?: string;
  }>({
    accessToken: input.accessToken,
    body: {
      fields: ["summary", "status", "assignee", "issuetype"],
      jql,
      maxResults,
      startAt,
    },
    cloudId: input.cloudId,
    method: "POST",
    path: "/rest/api/3/search/jql",
  });

  const issues = (data?.issues ?? []).map((issue) => ({
    assignee: issue.fields?.assignee?.displayName,
    id: issue.id,
    key: issue.key,
    status: issue.fields?.status?.name,
    summary: issue.fields?.summary,
    url: issue.key
      ? `${input.siteUrl.replace(/\/+$/, "")}/browse/${issue.key}`
      : undefined,
  }));

  return {
    issues,
    jql,
    nextPageToken: data?.nextPageToken,
    summary: `${issues.length} issue${issues.length === 1 ? "" : "s"}`,
    total: data?.total ?? issues.length,
  };
}

export async function jiraGetIssue(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  issueIdOrKey: string;
  fields?: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const issueIdOrKey = input.issueIdOrKey.trim();
  if (!issueIdOrKey) {
    throw new Error("issueIdOrKey is required.");
  }

  const { data } = await jiraFetch<{
    id?: string;
    key?: string;
    fields?: Record<string, unknown>;
  }>({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`,
    query: {
      fields:
        input.fields?.trim() ||
        "summary,description,status,assignee,issuetype,priority,created,updated",
    },
  });

  if (!data?.key) {
    throw new Error(`Issue not found: ${issueIdOrKey}`);
  }

  const summary = String(data.fields?.summary ?? "").trim();
  const status = (data.fields?.status as { name?: string } | undefined)?.name;
  const assignee = (
    data.fields?.assignee as { displayName?: string } | undefined
  )?.displayName;
  const issueType = (data.fields?.issuetype as { name?: string } | undefined)
    ?.name;

  return {
    assignee,
    fields: data.fields,
    id: data.id,
    issueType,
    key: data.key,
    status,
    summary,
    title: summary ? `${data.key}: ${summary}` : data.key,
    url: `${input.siteUrl.replace(/\/+$/, "")}/browse/${data.key}`,
  };
}

export async function jiraCreateIssue(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  projectKey: string;
  summary: string;
  issueType: string;
  description?: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const projectKey = input.projectKey.trim();
  const summary = input.summary.trim();
  const issueType = input.issueType.trim();
  if (!projectKey || !summary || !issueType) {
    throw new Error("projectKey, summary, and issueType are required.");
  }

  const fields: Record<string, unknown> = {
    issuetype: { name: issueType },
    project: { key: projectKey },
    summary,
  };
  if (input.description?.trim()) {
    fields.description = plainTextAdf(input.description.trim());
  }

  const { data } = await jiraFetch<{
    id?: string;
    key?: string;
    self?: string;
  }>({
    accessToken: input.accessToken,
    body: { fields },
    cloudId: input.cloudId,
    method: "POST",
    path: "/rest/api/3/issue",
  });

  if (!data?.key) {
    throw new Error("Failed to create Jira issue.");
  }

  return {
    id: data.id,
    key: data.key,
    self: data.self,
    summary,
    title: `${data.key}: ${summary}`,
    url: `${input.siteUrl.replace(/\/+$/, "")}/browse/${data.key}`,
  };
}

export async function jiraUpdateIssue(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  issueIdOrKey: string;
  summary?: string;
  description?: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const issueIdOrKey = input.issueIdOrKey.trim();
  if (!issueIdOrKey) {
    throw new Error("issueIdOrKey is required.");
  }

  const fields: Record<string, unknown> = {};
  if (input.summary?.trim()) {
    fields.summary = input.summary.trim();
  }
  if (input.description?.trim()) {
    fields.description = plainTextAdf(input.description.trim());
  }
  if (Object.keys(fields).length === 0) {
    throw new Error("Provide summary and/or description to update.");
  }

  await jiraFetch({
    accessToken: input.accessToken,
    body: { fields },
    cloudId: input.cloudId,
    method: "PUT",
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`,
  });

  return {
    issueIdOrKey,
    summary: `Updated ${issueIdOrKey}`,
    title: issueIdOrKey,
    url: `${input.siteUrl.replace(/\/+$/, "")}/browse/${issueIdOrKey}`,
  };
}

export async function jiraListTransitions(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  issueIdOrKey: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const issueIdOrKey = input.issueIdOrKey.trim();
  if (!issueIdOrKey) {
    throw new Error("issueIdOrKey is required.");
  }

  const { data } = await jiraFetch<{
    transitions?: Array<{ id?: string; name?: string; to?: { name?: string } }>;
  }>({
    accessToken: input.accessToken,
    cloudId: input.cloudId,
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/transitions`,
  });

  const transitions = (data?.transitions ?? [])
    .filter((transition) => transition.id && transition.name)
    .map((transition) => ({
      id: transition.id,
      name: transition.name,
      toStatus: transition.to?.name,
    }));

  return {
    issueIdOrKey,
    summary: `${transitions.length} transition${transitions.length === 1 ? "" : "s"}`,
    transitions,
  };
}

export async function jiraTransitionIssue(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  issueIdOrKey: string;
  transitionId: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const issueIdOrKey = input.issueIdOrKey.trim();
  const transitionId = input.transitionId.trim();
  if (!issueIdOrKey || !transitionId) {
    throw new Error("issueIdOrKey and transitionId are required.");
  }

  await jiraFetch({
    accessToken: input.accessToken,
    body: {
      transition: { id: transitionId },
    },
    cloudId: input.cloudId,
    method: "POST",
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/transitions`,
  });

  return {
    issueIdOrKey,
    success: true,
    summary: `Transitioned ${issueIdOrKey}`,
    url: `${input.siteUrl.replace(/\/+$/, "")}/browse/${issueIdOrKey}`,
  };
}

export async function jiraAddComment(input: {
  tenantId: string;
  accessToken: string;
  cloudId: string;
  siteUrl: string;
  issueIdOrKey: string;
  body: string;
}) {
  await assertJiraActionAllowed({ tenantId: input.tenantId });

  const issueIdOrKey = input.issueIdOrKey.trim();
  const body = input.body.trim();
  if (!issueIdOrKey || !body) {
    throw new Error("issueIdOrKey and body are required.");
  }

  const { data } = await jiraFetch<{
    id?: string;
    self?: string;
    author?: { displayName?: string };
    created?: string;
  }>({
    accessToken: input.accessToken,
    body: {
      body: plainTextAdf(body),
    },
    cloudId: input.cloudId,
    method: "POST",
    path: `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/comment`,
  });

  return {
    author: data?.author?.displayName,
    created: data?.created,
    id: data?.id,
    issueIdOrKey,
    self: data?.self,
    summary: `Comment on ${issueIdOrKey}`,
    url: `${input.siteUrl.replace(/\/+$/, "")}/browse/${issueIdOrKey}`,
  };
}
