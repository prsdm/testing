import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { assertNotionActionAllowed } from "@/core/lib/connectors/providers/notion/auth";
import { getPrimaryDataSourceForDatabase } from "@/core/lib/connectors/providers/notion/data-source";
import { buildNotionDatabaseCreateBody } from "@/core/lib/connectors/providers/notion/database-create-body";
import { resolveDatabasePropertiesSchema } from "@/core/lib/connectors/providers/notion/database-properties-schema";
import { resolveNotionCreateParent } from "@/core/lib/connectors/providers/notion/resolve-create-parent";

export async function notionCreateDatabase(input: {
  tenantId: string;
  accessToken: string;
  parentPageId?: string;
  parentPageTitle?: string;
  title: string;
  properties?: string;
}): Promise<{
  databaseId: string;
  dataSourceId: string;
  title: string;
  link?: string;
  parentType: "workspace" | "page";
  parentPageId?: string;
}> {
  await assertNotionActionAllowed({
    action: "create",
    tenantId: input.tenantId,
  });
  const parent = await resolveNotionCreateParent({
    accessToken: input.accessToken,
    parentPageId: input.parentPageId,
    parentPageTitle: input.parentPageTitle,
  });
  const title = input.title.trim() || "Untitled database";
  const properties = resolveDatabasePropertiesSchema(input.properties);
  const response = await notionFetch({
    accessToken: input.accessToken,
    body: buildNotionDatabaseCreateBody({ parent, properties, title }),
    method: "POST",
    path: "/databases",
  });
  const created = (await response.json()) as {
    id?: string;
    url?: string;
  };
  if (!created.id) {
    throw new Error("Notion did not return created database details.");
  }
  const dataSource = await getPrimaryDataSourceForDatabase({
    accessToken: input.accessToken,
    databaseId: created.id,
  });
  return {
    databaseId: created.id,
    dataSourceId: dataSource.dataSourceId,
    link: created.url,
    parentType: parent.type,
    title,
    ...(parent.type === "page" ? { parentPageId: parent.pageId } : {}),
  };
}
