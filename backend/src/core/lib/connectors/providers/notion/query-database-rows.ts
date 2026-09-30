import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { getNotionDatabaseSchema } from "@/core/lib/connectors/providers/notion/database-schema";

export type NotionDatabaseRowSummary = {
  rowId: string;
  title: string;
  link: string;
  modifiedTime?: string;
  properties: Record<string, unknown>;
};

export async function queryAllNotionDatabaseRows(input: {
  accessToken: string;
  databaseId: string;
  maxRows?: number;
}): Promise<{ databaseTitle: string; rows: NotionDatabaseRowSummary[] }> {
  const schema = await getNotionDatabaseSchema({
    accessToken: input.accessToken,
    databaseId: input.databaseId,
  });
  const maxRows = Math.min(input.maxRows ?? 100, 200);
  const rows: NotionDatabaseRowSummary[] = [];
  let cursor: string | undefined;

  while (rows.length < maxRows) {
    const response = await notionFetch({
      accessToken: input.accessToken,
      body: {
        page_size: Math.min(100, maxRows - rows.length),
        start_cursor: cursor,
      },
      method: "POST",
      path: `/data_sources/${encodeURIComponent(schema.dataSourceId)}/query`,
    });
    const payload = (await response.json()) as {
      results?: Array<{
        id?: string;
        url?: string;
        last_edited_time?: string;
        properties?: Record<string, unknown>;
      }>;
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const result of payload.results ?? []) {
      if (!result.id || !result.url) {
        continue;
      }
      rows.push({
        link: result.url,
        modifiedTime: result.last_edited_time,
        properties: result.properties ?? {},
        rowId: result.id,
        title: extractRowTitle(result.properties ?? {}),
      });
      if (rows.length >= maxRows) {
        break;
      }
    }

    if (!payload.has_more || !payload.next_cursor || rows.length >= maxRows) {
      break;
    }
    cursor = payload.next_cursor;
  }

  return {
    databaseTitle: schema.title,
    rows,
  };
}

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
