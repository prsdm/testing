import { jiraSearchIssues } from "@/core/lib/connectors/providers/jira/actions";
import { ensureFreshJiraAccessToken } from "@/core/lib/connectors/providers/jira/credential-token";
import { getJiraConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { FEDERATED_LIVE_LIMIT } from "./constants";
import { buildJiraTextSearchJql } from "./jira-jql";
import { type FederatedSourceResult, federatedErrorMessage } from "./outcome";

function jiraDocumentId(args: { key?: string; id?: string; index: number }) {
  const key = args.key?.trim();
  if (key) {
    return `jira:${key}`;
  }
  const id = args.id?.trim();
  if (id) {
    return `jira:id:${id}`;
  }
  return `jira:unknown:${args.index}`;
}

function jiraContent(args: {
  key?: string;
  summary?: string;
  status?: string;
  assignee?: string;
}) {
  const lines = [
    args.key ? `Issue: ${args.key}` : null,
    args.summary ? `Summary: ${args.summary}` : null,
    args.status ? `Status: ${args.status}` : null,
    args.assignee ? `Assignee: ${args.assignee}` : null,
  ].filter(Boolean);
  return lines.join("\n") || "Jira issue";
}

/** Live Jira text search → ranked chunks. Empty on missing credential or API errors. */
export async function searchJiraFederated(args: {
  tenantId: string;
  userId: string;
  query: string;
  limit?: number;
}): Promise<FederatedSourceResult> {
  const query = args.query.trim();
  if (!query) {
    return { results: [] };
  }

  const connector = await getJiraConnectorForTenantUser({
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connector) {
    return {
      error: "Connect your own Jira account for live search.",
      results: [],
    };
  }

  try {
    const token = await ensureFreshJiraAccessToken({
      credentialId: connector.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    const result = await jiraSearchIssues({
      accessToken: token.accessToken,
      cloudId: token.cloudId,
      jql: buildJiraTextSearchJql(query),
      maxResults: Math.min(
        args.limit ?? FEDERATED_LIVE_LIMIT,
        FEDERATED_LIVE_LIMIT
      ),
      siteUrl: token.siteUrl,
      tenantId: args.tenantId,
    });

    const results = result.issues.map((issue, index) => {
      const summary = issue.summary?.trim() || issue.key || "Jira issue";
      const content = jiraContent({
        assignee: issue.assignee,
        key: issue.key,
        status: issue.status,
        summary: issue.summary,
      });
      return {
        blurb: content.slice(0, 240),
        chunkIndex: 0,
        content,
        documentId: jiraDocumentId({
          id: issue.id,
          index,
          key: issue.key,
        }),
        link: issue.url?.trim() ?? "",
        score: 1 - index * 0.01,
        sourceType: "jira" as const,
        title: issue.key ? `${issue.key}: ${summary}` : summary,
      };
    });

    return { results };
  } catch (error) {
    return {
      error: federatedErrorMessage("Jira", error),
      results: [],
    };
  }
}
