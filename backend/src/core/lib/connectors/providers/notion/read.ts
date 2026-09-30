import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { resolveReadableContent } from "@/core/lib/sources/index-content-limits";

export type NotionPageSummary = {
  pageId: string;
  title: string;
  link: string;
  modifiedTime?: string;
  parentDataSourceId?: string;
};

export type NotionPageContent = NotionPageSummary & {
  content: string;
  truncated: boolean;
};

type NotionRichText = {
  plain_text?: string;
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

function extractPageParentDataSourceId(parent?: {
  type?: string;
  data_source_id?: string;
}) {
  if (parent?.type === "data_source_id" && parent.data_source_id) {
    return parent.data_source_id;
  }
}

function extractPageTitle(page: {
  properties?: Record<string, unknown>;
  id?: string;
}) {
  const values = Object.values(page.properties ?? {});
  for (const value of values) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const candidate = value as {
      type?: string;
      title?: NotionRichText[];
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
  return page.id ? `Untitled (${page.id.slice(0, 8)})` : "Untitled";
}

function toPageSummary(page: {
  id?: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
  parent?: {
    type?: string;
    data_source_id?: string;
  };
}): NotionPageSummary | null {
  if (!page.id || !page.url) {
    return null;
  }
  return {
    link: page.url,
    modifiedTime: page.last_edited_time,
    pageId: page.id,
    parentDataSourceId: extractPageParentDataSourceId(page.parent),
    title: extractPageTitle(page),
  };
}

function extractBlockText(block: NotionBlock): string {
  const value = block[block.type];
  if (!value || typeof value !== "object") {
    return "";
  }
  const richText = (value as { rich_text?: NotionRichText[] }).rich_text ?? [];
  return richText
    .map((item) => item.plain_text ?? "")
    .join("")
    .trim();
}

async function listBlockChildren(args: {
  accessToken: string;
  blockId: string;
  depth: number;
}): Promise<string[]> {
  if (args.depth > 3) {
    return [];
  }

  const lines: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ page_size: "100" });
    if (cursor) {
      params.set("start_cursor", cursor);
    }
    const response = await notionFetch({
      accessToken: args.accessToken,
      path: `/blocks/${encodeURIComponent(args.blockId)}/children?${params.toString()}`,
    });
    const payload = (await response.json()) as {
      results?: NotionBlock[];
      has_more?: boolean;
      next_cursor?: string | null;
    };
    const blocks = payload.results ?? [];
    for (const block of blocks) {
      const text = extractBlockText(block);
      if (text) {
        lines.push(text);
      }
      if (block.has_children) {
        const childLines = await listBlockChildren({
          accessToken: args.accessToken,
          blockId: block.id,
          depth: args.depth + 1,
        });
        lines.push(...childLines);
      }
    }
    if (!payload.has_more || !payload.next_cursor) {
      break;
    }
    cursor = payload.next_cursor;
  }

  return lines;
}

export async function notionGetPageBodyPreview(args: {
  accessToken: string;
  pageId: string;
  maxChars?: number;
}): Promise<string> {
  const maxChars = args.maxChars ?? 4000;
  const lines = await listBlockChildren({
    accessToken: args.accessToken,
    blockId: args.pageId.trim(),
    depth: 0,
  });
  const text = lines.join("\n").trim();
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars);
}

export async function notionBrowsePages(args: {
  accessToken: string;
  query?: string;
  startCursor?: string;
  limit?: number;
}): Promise<{ pages: NotionPageSummary[]; nextCursor?: string }> {
  const limit = Math.min(args.limit ?? 20, 100);
  const response = await notionFetch({
    accessToken: args.accessToken,
    body: {
      filter: { property: "object", value: "page" },
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
    results?: Array<{
      object?: string;
      id?: string;
      url?: string;
      last_edited_time?: string;
      properties?: Record<string, unknown>;
      parent?: {
        type?: string;
        data_source_id?: string;
      };
    }>;
    next_cursor?: string | null;
  };

  const pages = (payload.results ?? [])
    .filter((result) => result.object === "page")
    .map(toPageSummary)
    .filter((page): page is NotionPageSummary => page !== null);

  return {
    nextCursor: payload.next_cursor ?? undefined,
    pages,
  };
}

export async function notionGetDataSourceTitles(args: {
  accessToken: string;
  dataSourceIds: string[];
}) {
  const entries = await Promise.all(
    [...new Set(args.dataSourceIds.map((id) => id.trim()).filter(Boolean))].map(
      async (dataSourceId) => {
        const response = await notionFetch({
          accessToken: args.accessToken,
          path: `/data_sources/${encodeURIComponent(dataSourceId)}`,
        }).catch(() => null);
        if (!response) {
          return [dataSourceId, null] as const;
        }
        const payload = (await response.json()) as {
          title?: Array<{ plain_text?: string }>;
        };
        const title = (payload.title ?? [])
          .map((part) => part.plain_text ?? "")
          .join("")
          .trim();
        return [dataSourceId, title || null] as const;
      }
    )
  );
  return new Map(entries);
}

export async function notionGetPageContent(args: {
  accessToken: string;
  pageId: string;
  maxContentBytes?: number;
  maxContentMb?: number;
}): Promise<NotionPageContent> {
  const pageId = args.pageId.trim();
  const pageResponse = await notionFetch({
    accessToken: args.accessToken,
    path: `/pages/${encodeURIComponent(pageId)}`,
  });
  const pagePayload = (await pageResponse.json()) as {
    id?: string;
    url?: string;
    last_edited_time?: string;
    properties?: Record<string, unknown>;
    parent?: {
      type?: string;
      data_source_id?: string;
    };
  };
  const summary = toPageSummary(pagePayload);
  if (!summary) {
    throw new Error("Notion page not found.");
  }

  const lines = await listBlockChildren({
    accessToken: args.accessToken,
    blockId: summary.pageId,
    depth: 0,
  });
  const text = lines.join("\n").trim();
  const { content, truncated } = resolveReadableContent(
    text,
    args.maxContentBytes === undefined
      ? undefined
      : {
          maxContentBytes: args.maxContentBytes,
          maxContentMb: args.maxContentMb,
        }
  );
  return {
    ...summary,
    content,
    truncated,
  };
}

export async function notionCanAccessPage(args: {
  accessToken: string;
  pageId: string;
}): Promise<boolean> {
  const pageId = args.pageId.trim();
  if (!pageId) {
    return false;
  }
  const response = await notionFetch({
    accessToken: args.accessToken,
    path: `/pages/${encodeURIComponent(pageId)}`,
  }).catch(() => null);

  return Boolean(response);
}
