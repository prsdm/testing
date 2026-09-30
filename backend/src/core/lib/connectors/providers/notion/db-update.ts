import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { applyPageContent } from "@/core/lib/connectors/providers/notion/page-blocks";
import { parseNotionPropertiesJson } from "@/core/lib/connectors/providers/notion/properties";
import { resolveNotionDbRow } from "@/core/lib/connectors/providers/notion/resolve-db-row";
import { resolveNotionRowProperties } from "@/core/lib/connectors/providers/notion/resolve-row-properties";

export async function notionDbUpdateRow(input: {
  tenantId: string;
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
  rowId?: string;
  rowTitle?: string;
  properties?: string;
  content?: string;
  contentMode?: "append" | "replace";
}): Promise<{
  rowId: string;
  title: string;
  link: string;
  databaseId: string;
}> {
  await assertNotionActionAllowed({
    action: "write",
    tenantId: input.tenantId,
  });
  const row = await resolveNotionDbRow({
    accessToken: input.accessToken,
    databaseId: input.databaseId,
    databaseTitle: input.databaseTitle,
    rowId: input.rowId,
    rowTitle: input.rowTitle,
  });
  const content = input.content?.trim();
  const extraProperties = input.properties
    ? await resolveNotionRowProperties({
        accessToken: input.accessToken,
        properties: parseNotionPropertiesJson(input.properties),
      })
    : null;
  if (!content && !extraProperties) {
    throw new Error("Provide properties and/or content to update.");
  }

  const pageResponse = await notionFetch({
    accessToken: input.accessToken,
    path: `/pages/${encodeURIComponent(row.rowId)}`,
  });
  const pagePayload = (await pageResponse.json()) as {
    id?: string;
    url?: string;
    properties?: Record<string, unknown>;
  };
  if (!pagePayload.id || !pagePayload.url) {
    throw new Error("Notion database row not found.");
  }

  if (extraProperties && Object.keys(extraProperties).length > 0) {
    await notionFetch({
      accessToken: input.accessToken,
      body: { properties: extraProperties },
      method: "PATCH",
      path: `/pages/${encodeURIComponent(row.rowId)}`,
    });
  }

  if (content) {
    await applyPageContent({
      accessToken: input.accessToken,
      content,
      contentMode: input.contentMode,
      pageId: row.rowId,
    });
  }

  return {
    databaseId: row.databaseId,
    link: pagePayload.url,
    rowId: pagePayload.id,
    title: row.title,
  };
}
