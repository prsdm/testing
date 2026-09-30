import {
  buildDataSourceParentPayload,
  buildPageParentPayload,
  notionFetch,
} from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { getNotionDatabaseSchema } from "@/core/lib/connectors/providers/notion/database-schema";
import { resolveNotionDatabaseId } from "@/core/lib/connectors/providers/notion/resolve-database-by-title";
import { resolveNotionDbRow } from "@/core/lib/connectors/providers/notion/resolve-db-row";
import { resolveNotionPageId } from "@/core/lib/connectors/providers/notion/resolve-page-by-title";

export async function notionDbMoveRow(input: {
  tenantId: string;
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
  rowId?: string;
  rowTitle?: string;
  toDatabaseId?: string;
  toDatabaseTitle?: string;
  toParentPageId?: string;
  toParentPageTitle?: string;
}): Promise<{
  rowId: string;
  title: string;
  link: string;
  parentType: "database" | "page";
  parentId: string;
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

  const hasDatabaseDestination = Boolean(
    input.toDatabaseId?.trim() || input.toDatabaseTitle?.trim()
  );
  const hasPageDestination = Boolean(
    input.toParentPageId?.trim() || input.toParentPageTitle?.trim()
  );
  if (hasDatabaseDestination === hasPageDestination) {
    throw new Error(
      "Provide either toDatabaseId/toDatabaseTitle or toParentPageId/toParentPageTitle as the move destination."
    );
  }

  const parent = hasDatabaseDestination
    ? await (async () => {
        const database = await resolveNotionDatabaseId({
          accessToken: input.accessToken,
          databaseId: input.toDatabaseId,
          databaseTitle: input.toDatabaseTitle,
        });
        const schema = await getNotionDatabaseSchema({
          accessToken: input.accessToken,
          databaseId: database.databaseId,
        });
        return {
          parentId: schema.dataSourceId,
          parentPayload: buildDataSourceParentPayload(schema.dataSourceId),
          type: "data_source" as const,
        };
      })()
    : await (async () => {
        const page = await resolveNotionPageId({
          accessToken: input.accessToken,
          idLabel: "toParentPageId",
          pageId: input.toParentPageId,
          pageTitle: input.toParentPageTitle,
          titleLabel: "toParentPageTitle",
        });
        return {
          parentId: page.pageId,
          parentPayload: buildPageParentPayload({
            pageId: page.pageId,
            type: "page",
          }),
          type: "page" as const,
        };
      })();

  const response = await notionFetch({
    accessToken: input.accessToken,
    body: {
      parent: parent.parentPayload,
    },
    method: "POST",
    path: `/pages/${encodeURIComponent(row.rowId)}/move`,
  });
  const moved = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!moved.id || !moved.url) {
    throw new Error("Notion did not return moved row details.");
  }

  return {
    link: moved.url,
    parentId: parent.parentId,
    parentType: parent.type === "data_source" ? "database" : "page",
    rowId: moved.id,
    title: row.title,
  };
}
