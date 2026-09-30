import { NOTION_TOOL_IDS } from "@/core/lib/connectors/providers/notion/chat-tools";
import { connectUrlIfAuthError } from "@/shared/connectors/connect-on-auth-error";

export { notionToolIdsForConnector } from "@/core/lib/connectors/providers/notion/chat-tools";

import { notionCreatePage } from "@/core/lib/connectors/providers/notion/create";
import { notionCreateDatabase } from "@/core/lib/connectors/providers/notion/create-database";
import { ensureFreshNotionAccessToken } from "@/core/lib/connectors/providers/notion/credential-token";
import { notionDbCreateRow } from "@/core/lib/connectors/providers/notion/db-create";
import { notionDbMoveRow } from "@/core/lib/connectors/providers/notion/db-move";
import { notionDbRenameRow } from "@/core/lib/connectors/providers/notion/db-rename-row";
import { notionDbUpdateRow } from "@/core/lib/connectors/providers/notion/db-update";
import { notionMovePage } from "@/core/lib/connectors/providers/notion/move";
import { notionRenamePage } from "@/core/lib/connectors/providers/notion/rename-page";
import { notionUpdatePage } from "@/core/lib/connectors/providers/notion/update";

export type NotionToolId = (typeof NOTION_TOOL_IDS)[number];

export function isNotionToolId(toolId: string): toolId is NotionToolId {
  return (NOTION_TOOL_IDS as readonly string[]).includes(toolId);
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

export async function executeNotion(
  toolId: NotionToolId,
  merged: Record<string, unknown>
): Promise<unknown> {
  const tenantId = String(merged.tenantId ?? "");
  const tenantSlug = String(merged.tenantSlug ?? "");
  const credentialId = String(merged.credentialId ?? "");
  const userId = String(merged.userId ?? "");
  if (!tenantId || !tenantSlug || !credentialId || !userId) {
    return { error: "Notion connection context is incomplete." };
  }
  if (!isNotionToolId(toolId)) {
    return { error: `Unsupported Notion tool: ${toolId}` };
  }

  try {
    const token = await ensureFreshNotionAccessToken({
      credentialId,
      tenantId,
      userId,
    });

    if (toolId === "notionCreatePage") {
      return await notionCreatePage({
        accessToken: token.accessToken,
        content: optionalString(merged.content),
        parentPageId: optionalString(merged.parentPageId),
        parentPageTitle: optionalString(merged.parentPageTitle),
        tenantId,
        title: String(merged.title ?? ""),
      });
    }
    if (toolId === "notionCreateDatabase") {
      return await notionCreateDatabase({
        accessToken: token.accessToken,
        parentPageId: optionalString(merged.parentPageId),
        parentPageTitle: optionalString(merged.parentPageTitle),
        properties: optionalString(merged.properties),
        tenantId,
        title: String(merged.title ?? ""),
      });
    }
    if (toolId === "notionRenamePage") {
      return await notionRenamePage({
        accessToken: token.accessToken,
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        tenantId,
        title: String(merged.title ?? ""),
      });
    }
    if (toolId === "notionUpdatePage") {
      return await notionUpdatePage({
        accessToken: token.accessToken,
        content: String(merged.content ?? ""),
        contentMode: parseContentMode(merged.contentMode),
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        tenantId,
      });
    }
    if (toolId === "notionMovePage") {
      return await notionMovePage({
        accessToken: token.accessToken,
        pageId: optionalString(merged.pageId),
        pageTitle: optionalString(merged.pageTitle),
        parentPageId: optionalString(merged.parentPageId),
        parentPageTitle: optionalString(merged.parentPageTitle),
        tenantId,
      });
    }
    if (toolId === "notionDbCreateRow") {
      return await notionDbCreateRow({
        accessToken: token.accessToken,
        content: optionalString(merged.content),
        databaseId: optionalString(merged.databaseId),
        databaseTitle: optionalString(merged.databaseTitle),
        properties: optionalString(merged.properties),
        tenantId,
        title: String(merged.title ?? ""),
      });
    }
    if (toolId === "notionDbRenameRow") {
      return await notionDbRenameRow({
        accessToken: token.accessToken,
        databaseId: optionalString(merged.databaseId),
        databaseTitle: optionalString(merged.databaseTitle),
        rowId: optionalString(merged.rowId),
        rowTitle: optionalString(merged.rowTitle),
        tenantId,
        title: String(merged.title ?? ""),
      });
    }
    if (toolId === "notionDbUpdateRow") {
      return await notionDbUpdateRow({
        accessToken: token.accessToken,
        content: optionalString(merged.content),
        contentMode: parseContentMode(merged.contentMode),
        databaseId: optionalString(merged.databaseId),
        databaseTitle: optionalString(merged.databaseTitle),
        properties: optionalString(merged.properties),
        rowId: optionalString(merged.rowId),
        rowTitle: optionalString(merged.rowTitle),
        tenantId,
      });
    }
    if (toolId === "notionDbMoveRow") {
      return await notionDbMoveRow({
        accessToken: token.accessToken,
        databaseId: optionalString(merged.databaseId),
        databaseTitle: optionalString(merged.databaseTitle),
        rowId: optionalString(merged.rowId),
        rowTitle: optionalString(merged.rowTitle),
        tenantId,
        toDatabaseId: optionalString(merged.toDatabaseId),
        toDatabaseTitle: optionalString(merged.toDatabaseTitle),
        toParentPageId: optionalString(merged.toParentPageId),
        toParentPageTitle: optionalString(merged.toParentPageTitle),
      });
    }
    return { error: `Unsupported Notion tool: ${toolId}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Notion action failed.",
      ...connectUrlIfAuthError({ error }),
    };
  }
}
