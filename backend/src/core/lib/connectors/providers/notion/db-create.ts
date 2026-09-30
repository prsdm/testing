import {
  buildDataSourceParentPayload,
  notionFetch,
} from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { parseContentToNotionBlocks } from "@/core/lib/connectors/providers/notion/blocks";
import { getNotionDatabaseSchema } from "@/core/lib/connectors/providers/notion/database-schema";
import {
  buildTitlePropertyValue,
  parseNotionPropertiesJson,
} from "@/core/lib/connectors/providers/notion/properties";
import { resolveNotionDatabaseId } from "@/core/lib/connectors/providers/notion/resolve-database-by-title";
import { resolveNotionRowProperties } from "@/core/lib/connectors/providers/notion/resolve-row-properties";

export async function notionDbCreateRow(input: {
  tenantId: string;
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
  title: string;
  properties?: string;
  content?: string;
}): Promise<{
  rowId: string;
  title: string;
  link: string;
  databaseId: string;
  dataSourceId: string;
}> {
  await assertNotionActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const database = await resolveNotionDatabaseId({
    accessToken: input.accessToken,
    databaseId: input.databaseId,
    databaseTitle: input.databaseTitle,
  });
  const schema = await getNotionDatabaseSchema({
    accessToken: input.accessToken,
    databaseId: database.databaseId,
  });
  const title = input.title.trim() || "Untitled";
  const extraProperties = input.properties
    ? await resolveNotionRowProperties({
        accessToken: input.accessToken,
        properties: parseNotionPropertiesJson(input.properties),
      })
    : {};
  const response = await notionFetch({
    accessToken: input.accessToken,
    body: {
      children: parseContentToNotionBlocks(input.content ?? ""),
      parent: buildDataSourceParentPayload(schema.dataSourceId),
      properties: {
        ...extraProperties,
        [schema.titlePropertyKey]: buildTitlePropertyValue(title),
      },
    },
    method: "POST",
    path: "/pages",
  });
  const created = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!created.id || !created.url) {
    throw new Error("Notion did not return created database row details.");
  }
  return {
    databaseId: schema.databaseId,
    dataSourceId: schema.dataSourceId,
    link: created.url,
    rowId: created.id,
    title,
  };
}
