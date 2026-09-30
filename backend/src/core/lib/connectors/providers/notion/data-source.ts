import { notionFetch } from "@/core/lib/connectors/providers/notion/api";

export type NotionDataSourceRef = {
  databaseId: string;
  dataSourceId: string;
  databaseTitle: string;
};

function extractDatabaseTitle(payload: {
  title?: Array<{ plain_text?: string }>;
  id?: string;
}) {
  const title = (payload.title ?? [])
    .map((part) => part.plain_text ?? "")
    .join("")
    .trim();
  if (title) {
    return title;
  }
  return payload.id
    ? `Untitled (${payload.id.slice(0, 8)})`
    : "Untitled database";
}

export async function getDatabaseIdForDataSource(input: {
  accessToken: string;
  dataSourceId: string;
}): Promise<string> {
  const response = await notionFetch({
    accessToken: input.accessToken,
    path: `/data_sources/${encodeURIComponent(input.dataSourceId.trim())}`,
  });
  const payload = (await response.json()) as {
    parent?: { type?: string; database_id?: string };
  };
  const databaseId =
    payload.parent?.type === "database_id"
      ? payload.parent.database_id
      : undefined;
  if (!databaseId) {
    throw new Error("Notion data source parent database not found.");
  }
  return databaseId;
}

export async function getPrimaryDataSourceForDatabase(input: {
  accessToken: string;
  databaseId: string;
}): Promise<NotionDataSourceRef> {
  const response = await notionFetch({
    accessToken: input.accessToken,
    path: `/databases/${encodeURIComponent(input.databaseId.trim())}`,
  });
  const payload = (await response.json()) as {
    id?: string;
    title?: Array<{ plain_text?: string }>;
    data_sources?: Array<{ id?: string; name?: string }>;
  };
  const dataSourceId = payload.data_sources?.[0]?.id;
  if (!payload.id || !dataSourceId) {
    throw new Error("Notion database has no accessible data source.");
  }
  return {
    databaseId: payload.id,
    databaseTitle: extractDatabaseTitle(payload),
    dataSourceId,
  };
}
