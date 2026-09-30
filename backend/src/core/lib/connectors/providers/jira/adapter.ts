import { JIRA_TOOL_IDS } from "@/core/lib/connectors/providers/jira/chat-tools";
import { connectUrlIfAuthError } from "@/shared/connectors/connect-on-auth-error";

export { jiraToolIdsForConnector } from "@/core/lib/connectors/providers/jira/chat-tools";

import {
  jiraAddComment,
  jiraCreateIssue,
  jiraGetIssue,
  jiraListProjects,
  jiraListTransitions,
  jiraSearchIssues,
  jiraTransitionIssue,
  jiraUpdateIssue,
} from "@/core/lib/connectors/providers/jira/actions";
import { ensureFreshJiraAccessToken } from "@/core/lib/connectors/providers/jira/credential-token";

export type JiraToolId = (typeof JIRA_TOOL_IDS)[number];

export function isJiraToolId(toolId: string): toolId is JiraToolId {
  return (JIRA_TOOL_IDS as readonly string[]).includes(toolId);
}

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function optionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
}

function jiraContext(merged: Record<string, unknown>) {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");
  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Jira connection context is incomplete." as const };
  }
  return { credentialId, tenantId, tenantSlug, userId };
}

export async function executeJira(
  toolId: JiraToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const context = jiraContext(merged);
  if ("error" in context) {
    return context;
  }
  if (!isJiraToolId(toolId)) {
    return { error: `Unsupported Jira tool: ${toolId}` };
  }

  try {
    const token = await ensureFreshJiraAccessToken({
      credentialId: context.credentialId,
      tenantId: context.tenantId,
      userId: context.userId,
    });

    const base = {
      accessToken: token.accessToken,
      cloudId: token.cloudId,
      siteUrl: token.siteUrl,
      tenantId: context.tenantId,
    };

    if (toolId === "jiraListProjects") {
      return await jiraListProjects({
        accessToken: base.accessToken,
        cloudId: base.cloudId,
        maxResults: optionalNumber(merged.maxResults),
        query: optionalString(merged.query),
        startAt: optionalNumber(merged.startAt),
        tenantId: base.tenantId,
      });
    }

    if (toolId === "jiraSearchIssues") {
      return await jiraSearchIssues({
        ...base,
        jql: String(merged.jql ?? ""),
        maxResults: optionalNumber(merged.maxResults),
        startAt: optionalNumber(merged.startAt),
      });
    }

    if (toolId === "jiraGetIssue") {
      return await jiraGetIssue({
        ...base,
        fields: optionalString(merged.fields),
        issueIdOrKey: String(merged.issueIdOrKey ?? ""),
      });
    }

    if (toolId === "jiraCreateIssue") {
      return await jiraCreateIssue({
        ...base,
        description: optionalString(merged.description),
        issueType: String(merged.issueType ?? ""),
        projectKey: String(merged.projectKey ?? ""),
        summary: String(merged.summary ?? ""),
      });
    }

    if (toolId === "jiraUpdateIssue") {
      return await jiraUpdateIssue({
        ...base,
        description: optionalString(merged.description),
        issueIdOrKey: String(merged.issueIdOrKey ?? ""),
        summary: optionalString(merged.summary),
      });
    }

    if (toolId === "jiraListTransitions") {
      return await jiraListTransitions({
        accessToken: base.accessToken,
        cloudId: base.cloudId,
        issueIdOrKey: String(merged.issueIdOrKey ?? ""),
        tenantId: base.tenantId,
      });
    }

    if (toolId === "jiraTransitionIssue") {
      return await jiraTransitionIssue({
        ...base,
        issueIdOrKey: String(merged.issueIdOrKey ?? ""),
        transitionId: String(merged.transitionId ?? ""),
      });
    }

    if (toolId === "jiraAddComment") {
      return await jiraAddComment({
        ...base,
        body: String(merged.body ?? ""),
        issueIdOrKey: String(merged.issueIdOrKey ?? ""),
      });
    }

    return { error: `Unsupported Jira tool: ${toolId}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Jira action failed.",
      ...connectUrlIfAuthError({ error }),
    };
  }
}
