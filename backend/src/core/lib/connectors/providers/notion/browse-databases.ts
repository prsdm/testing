import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { getDatabaseIdForDataSource } from "@/core/lib/connectors/providers/notion/data-source";
import { notionGetDatabaseLink } from "@/core/lib/connectors/providers/notion/database-link";

export type NotionDatabaseSummary = {
  databaseId: string;
  title: string;
  link: string | null;
};

function extractDatabaseTitle(database: {
  id?: string;
  title?: Array<{ plain_text?: string }>;
}) {
  const title = (database.title ?? [])
    .map((part) => part.plain_text ?? "")
    .join("")
    .trim();
  if (title) {
    return title;
  }
  return database.id
    ? `Untitled (${database.id.slice(0, 8)})`
    : "Untitled database";
}

type SearchDataSourceResult = {
  object?: string;
  id?: string;
  title?: Array<{ plain_text?: string }>;
  parent?: { type?: string; database_id?: string };
};

async function dataSourceToDatabase(input: {
  accessToken: string;
  result: SearchDataSourceResult;
}): Promise<NotionDatabaseSummary | null> {
  if (input.result.object !== "data_source" || !input.result.id) {
    return null;
  }
  let databaseId =
    input.result.parent?.type === "database_id"
      ? input.result.parent.database_id
      : undefined;
  if (!databaseId) {
    databaseId = await getDatabaseIdForDataSource({
      accessToken: input.accessToken,
      dataSourceId: input.result.id,
    }).catch(() => undefined);
  }
  if (!databaseId) {
    return null;
  }
  const link = await notionGetDatabaseLink({
    accessToken: input.accessToken,
    databaseId,
  });
  return {
    databaseId,
    link,
    title: extractDatabaseTitle(input.result),
  };
}

function dedupeDatabases(databases: NotionDatabaseSummary[]) {
  const byId = new Map<string, NotionDatabaseSummary>();
  for (const database of databases) {
    if (!byId.has(database.databaseId)) {
      byId.set(database.databaseId, database);
    }
  }
  return [...byId.values()];
}

export async function notionBrowseDatabases(args: {
  accessToken: string;
  query?: string;
  startCursor?: string;
  limit?: number;
}): Promise<{ databases: NotionDatabaseSummary[]; nextCursor?: string }> {
  const limit = Math.min(args.limit ?? 20, 100);
  const response = await notionFetch({
    accessToken: args.accessToken,
    body: {
      filter: { property: "object", value: "data_source" },
      page_size: limit,
      query: args.query?.trim() || undefined,
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
      start_cursor: args.startCursor,
    },
    method: "POST",
    path: "/search",
  });
  const payload = (await response.json()) as {
    results?: SearchDataSourceResult[];
    next_cursor?: string | null;
  };

  const databases = await Promise.all(
    (payload.results ?? []).map((result) =>
      dataSourceToDatabase({ accessToken: args.accessToken, result })
    )
  );

  return {
    databases: dedupeDatabases(
      databases.filter(
        (database): database is NotionDatabaseSummary => database !== null
      )
    ),
    nextCursor: payload.next_cursor ?? undefined,
  };
}
