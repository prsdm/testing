import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import {
  buildTitlePropertyValue,
  findTitlePropertyKey,
} from "@/core/lib/connectors/providers/notion/properties";
import { resolveNotionDbRow } from "@/core/lib/connectors/providers/notion/resolve-db-row";

export async function notionDbRenameRow(input: {
  tenantId: string;
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
  rowId?: string;
  rowTitle?: string;
  title: string;
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
  const nextTitle = input.title.trim();
  if (!nextTitle) {
    throw new Error("title is required.");
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

  const titleKey = findTitlePropertyKey(pagePayload.properties ?? {});
  await notionFetch({
    accessToken: input.accessToken,
    body: {
      properties: {
        [titleKey]: buildTitlePropertyValue(nextTitle),
      },
    },
    method: "PATCH",
    path: `/pages/${encodeURIComponent(row.rowId)}`,
  });

  return {
    databaseId: row.databaseId,
    link: pagePayload.url,
    rowId: pagePayload.id,
    title: nextTitle,
  };
}
