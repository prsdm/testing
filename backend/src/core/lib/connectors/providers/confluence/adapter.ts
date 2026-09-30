import { CONFLUENCE_TOOL_IDS } from "@/core/lib/connectors/providers/confluence/chat-tools";
import { connectUrlIfAuthError } from "@/shared/connectors/connect-on-auth-error";

export { confluenceToolIdsForConnector } from "@/core/lib/connectors/providers/confluence/chat-tools";

import { confluenceCreatePage } from "@/core/lib/connectors/providers/confluence/create";
import { confluenceCreateSpace } from "@/core/lib/connectors/providers/confluence/create-space";
import { ensureFreshConfluenceAccessToken } from "@/core/lib/connectors/providers/confluence/credential-token";
import { confluenceMovePage } from "@/core/lib/connectors/providers/confluence/move";
import { confluenceRenamePage } from "@/core/lib/connectors/providers/confluence/rename-page";
import { confluenceUpdatePage } from "@/core/lib/connectors/providers/confluence/update";

export type ConfluenceToolId = (typeof CONFLUENCE_TOOL_IDS)[number];

export function isConfluenceToolId(toolId: string): toolId is ConfluenceToolId {
  return (CONFLUENCE_TOOL_IDS as readonly string[]).includes(toolId);
}

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}

function parseContentMode(value: unknown) {
  const raw = optionalString(value);
  if (raw === "replace" || raw === "append") {
    return raw;
  }
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
}

function confluenceContext(merged: Record<string, unknown>) {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");
  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Confluence connection context is incomplete." as const };
  }
  return { credentialId, tenantId, tenantSlug, userId };
}

export async function executeConfluence(
  toolId: ConfluenceToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const context = confluenceContext(merged);
  if ("error" in context) {
    return context;
  }
  if (!isConfluenceToolId(toolId)) {
    return { error: `Unsupported Confluence tool: ${toolId}` };
  }

  try {
    const token = await ensureFreshConfluenceAccessToken({
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

    if (toolId === "confluenceCreateSpace") {
      return await confluenceCreateSpace({
        ...base,
        description: optionalString(merged.description),
        isPrivate: optionalBoolean(merged.isPrivate),
        name: String(merged.name ?? ""),
        spaceKey: String(merged.spaceKey ?? ""),
      });
    }

    if (toolId === "confluenceCreatePage") {
      return await confluenceCreatePage({
        ...base,
        content: String(merged.content ?? ""),
        parentPageId: optionalString(merged.parentPageId),
        parentPageTitle: optionalString(merged.parentPageTitle),
        spaceKey: String(merged.spaceKey ?? ""),
        title: String(merged.title ?? ""),
      });
    }

    if (toolId === "confluenceRenamePage") {
      return await confluenceRenamePage({
        ...base,
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        spaceKey: optionalString(merged.spaceKey),
        title: String(merged.title ?? ""),
      });
    }

    if (toolId === "confluenceUpdatePage") {
      return await confluenceUpdatePage({
        ...base,
        content: String(merged.content ?? ""),
        contentMode: parseContentMode(merged.contentMode),
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        spaceKey: optionalString(merged.spaceKey),
      });
    }

    if (toolId === "confluenceMovePage") {
      return await confluenceMovePage({
        ...base,
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        parentPageId: optionalString(merged.parentPageId),
        parentPageTitle: optionalString(merged.parentPageTitle),
        spaceKey: optionalString(merged.spaceKey),
      });
    }

    return { error: `Unsupported Confluence tool: ${toolId}` };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Confluence action failed.",
      ...connectUrlIfAuthError({ error }),
    };
  }
}
