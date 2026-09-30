import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { getPrimaryDataSourceForDatabase } from "@/core/lib/connectors/providers/notion/data-source";
import { findTitlePropertyKey } from "@/core/lib/connectors/providers/notion/properties";

export type NotionDatabaseSchema = {
  databaseId: string;
  dataSourceId: string;
  title: string;
  properties: Record<string, unknown>;
  titlePropertyKey: string;
};

export async function getNotionDatabaseSchema(input: {
  accessToken: string;
  databaseId: string;
}): Promise<NotionDatabaseSchema> {
  const database = await getPrimaryDataSourceForDatabase({
    accessToken: input.accessToken,
    databaseId: input.databaseId,
  });
  const response = await notionFetch({
    accessToken: input.accessToken,
    path: `/data_sources/${encodeURIComponent(database.dataSourceId)}`,
  });
  const payload = (await response.json()) as {
    id?: string;
    properties?: Record<string, unknown>;
  };
  if (!payload.id) {
    throw new Error("Notion data source not found.");
  }
  const properties = payload.properties ?? {};
  return {
    databaseId: database.databaseId,
    dataSourceId: database.dataSourceId,
    properties,
    title: database.databaseTitle,
    titlePropertyKey: findTitlePropertyKey(properties),
  };
}
