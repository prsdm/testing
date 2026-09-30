import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { getDatabaseIdForDataSource } from "@/core/lib/connectors/providers/notion/data-source";
import { getNotionDatabaseSchema } from "@/core/lib/connectors/providers/notion/database-schema";
import {
  parseNotionId,
  slugLikeIdToTitle,
} from "@/core/lib/connectors/providers/notion/notion-id";
import { resolveNotionDatabaseId } from "@/core/lib/connectors/providers/notion/resolve-database-by-title";

export type ResolvedNotionDbRow = {
  rowId: string;
  title: string;
  link: string;
  databaseId: string;
  dataSourceId: string;
};

function extractRowTitle(properties: Record<string, unknown>) {
  for (const value of Object.values(properties)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const candidate = value as {
      type?: string;
      title?: Array<{ plain_text?: string }>;
    };
    if (candidate.type !== "title") {
      continue;
    }
    const text = (candidate.title ?? [])
      .map((item) => item.plain_text ?? "")
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "Untitled";
}

async function queryRowsByTitle(input: {
  accessToken: string;
  dataSourceId: string;
  titlePropertyKey: string;
  rowTitle: string;
}) {
  const response = await notionFetch({
    accessToken: input.accessToken,
    body: {
      filter: {
        property: input.titlePropertyKey,
        title: { equals: input.rowTitle.trim() },
      },
      page_size: 20,
    },
    method: "POST",
    path: `/data_sources/${encodeURIComponent(input.dataSourceId)}/query`,
  });
  const payload = (await response.json()) as {
    results?: Array<{
      id?: string;
      url?: string;
      properties?: Record<string, unknown>;
    }>;
  };
  return (payload.results ?? [])
    .filter((row) => row.id && row.url)
    .map((row) => ({
      link: row.url as string,
      rowId: row.id as string,
      title: extractRowTitle(row.properties ?? {}),
    }));
}

export async function resolveNotionDbRow(input: {
  accessToken: string;
  databaseId?: string;
  databaseTitle?: string;
  rowId?: string;
  rowTitle?: string;
}): Promise<ResolvedNotionDbRow> {
  let rowId = input.rowId?.trim();
  let rowTitle = input.rowTitle?.trim();

  if (rowId && !parseNotionId(rowId)) {
    if (!rowTitle) {
      rowTitle = slugLikeIdToTitle(rowId);
    }
    rowId = undefined;
  }

  const parsedRowId = rowId ? parseNotionId(rowId) : null;
  if (parsedRowId) {
    const pageResponse = await notionFetch({
      accessToken: input.accessToken,
      path: `/pages/${encodeURIComponent(parsedRowId)}`,
    });
    const page = (await pageResponse.json()) as {
      id?: string;
      url?: string;
      properties?: Record<string, unknown>;
      parent?: { type?: string; data_source_id?: string };
    };
    if (!page.id || !page.url) {
      throw new Error("Notion database row not found.");
    }
    const dataSourceId =
      page.parent?.type === "data_source_id"
        ? page.parent.data_source_id
        : undefined;
    let databaseId = input.databaseId?.trim();
    if (!databaseId && dataSourceId) {
      databaseId = await getDatabaseIdForDataSource({
        accessToken: input.accessToken,
        dataSourceId,
      }).catch(() => undefined);
    }
    return {
      databaseId: databaseId ?? "",
      dataSourceId: dataSourceId ?? "",
      link: page.url,
      rowId: page.id,
      title: extractRowTitle(page.properties ?? {}),
    };
  }

  const database = await resolveNotionDatabaseId({
    accessToken: input.accessToken,
    databaseId: input.databaseId,
    databaseTitle: input.databaseTitle,
  });
  const schema = await getNotionDatabaseSchema({
    accessToken: input.accessToken,
    databaseId: database.databaseId,
  });

  const trimmedRowTitle = input.rowTitle?.trim();
  if (!trimmedRowTitle) {
    throw new Error("rowId or rowTitle is required.");
  }

  const matches = await queryRowsByTitle({
    accessToken: input.accessToken,
    dataSourceId: schema.dataSourceId,
    rowTitle: trimmedRowTitle,
    titlePropertyKey: schema.titlePropertyKey,
  });
  if (matches.length === 0) {
    throw new Error(
      `No row titled "${trimmedRowTitle}" found in database "${schema.title}".`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple rows titled "${trimmedRowTitle}" in database "${schema.title}". Provide rowId instead.`
    );
  }
  return {
    ...matches[0],
    databaseId: schema.databaseId,
    dataSourceId: schema.dataSourceId,
  };
}
