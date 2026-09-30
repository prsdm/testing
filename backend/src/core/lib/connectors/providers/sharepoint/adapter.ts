import { SHAREPOINT_TOOL_IDS } from "@/core/lib/connectors/providers/sharepoint/chat-tools";
import { connectUrlIfAuthError } from "@/shared/connectors/connect-on-auth-error";

export { sharePointToolIdsForConnector } from "@/core/lib/connectors/providers/sharepoint/chat-tools";

import { sharePointCreatePage } from "@/core/lib/connectors/providers/sharepoint/create";
import { ensureFreshSharePointAccessToken } from "@/core/lib/connectors/providers/sharepoint/credential-token";
import { sharePointRenamePage } from "@/core/lib/connectors/providers/sharepoint/rename-page";
import { sharePointUpdatePage } from "@/core/lib/connectors/providers/sharepoint/update";

export type SharePointToolId = (typeof SHAREPOINT_TOOL_IDS)[number];

export function isSharePointToolId(toolId: string): toolId is SharePointToolId {
  return (SHAREPOINT_TOOL_IDS as readonly string[]).includes(toolId);
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

function sharePointContext(merged: Record<string, unknown>) {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");
  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "SharePoint connection context is incomplete." as const };
  }
  return { credentialId, tenantId, tenantSlug, userId };
}

export async function executeSharePoint(
  toolId: SharePointToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const context = sharePointContext(merged);
  if ("error" in context) {
    return context;
  }
  if (!isSharePointToolId(toolId)) {
    return { error: `Unsupported SharePoint tool: ${toolId}` };
  }

  try {
    const token = await ensureFreshSharePointAccessToken({
      credentialId: context.credentialId,
      tenantId: context.tenantId,
      userId: context.userId,
    });
    const base = {
      accessToken: token.accessToken,
      siteId: optionalString(merged.siteId),
      siteName: optionalString(merged.siteName),
      siteUrl: optionalString(merged.siteUrl),
      tenantId: context.tenantId,
    };

    if (toolId === "sharePointCreatePage") {
      return await sharePointCreatePage({
        ...base,
        content: String(merged.content ?? ""),
        title: String(merged.title ?? ""),
      });
    }

    if (toolId === "sharePointRenamePage") {
      return await sharePointRenamePage({
        ...base,
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        title: String(merged.title ?? ""),
      });
    }

    if (toolId === "sharePointUpdatePage") {
      return await sharePointUpdatePage({
        ...base,
        content: String(merged.content ?? ""),
        contentMode: parseContentMode(merged.contentMode),
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
      });
    }

    return { error: `Unsupported SharePoint tool: ${toolId}` };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "SharePoint action failed.",
      ...connectUrlIfAuthError({ error }),
    };
  }
}
