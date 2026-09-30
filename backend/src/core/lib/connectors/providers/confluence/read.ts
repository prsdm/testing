import {
  buildConfluencePageLink,
  confluenceGetPage,
  confluenceListPages,
  confluenceListSpaces,
  resolveConfluenceSpaceId,
} from "@/core/lib/connectors/providers/confluence/api";
import { resolveReadableContent } from "@/core/lib/sources/index-content-limits";

const MAX_TITLE_SEARCH_BATCHES = 10;

export type ConfluenceSpaceSummary = {
  spaceId: string;
  key: string;
  name: string;
  homepageId?: string;
};

export type ConfluencePageSummary = {
  pageId: string;
  title: string;
  link: string;
  modifiedTime?: string;
};

export type ConfluencePageContent = ConfluencePageSummary & {
  content: string;
  truncated: boolean;
};

function stripHtml(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function toPageSummary(
  siteUrl: string,
  page: {
    id?: string;
    title?: string;
    _links?: { webui?: string };
    version?: { when?: string; createdAt?: string };
  }
): ConfluencePageSummary | null {
  if (!page.id) {
    return null;
  }
  const link = buildConfluencePageLink({
    pageId: page.id,
    siteUrl,
    webUi: page._links?.webui,
  });
  return {
    link,
    modifiedTime: page.version?.when ?? page.version?.createdAt,
    pageId: page.id,
    title: page.title ?? "Untitled",
  };
}

function titleMatches(pageTitle: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return pageTitle.toLowerCase().includes(normalizedQuery);
}

function resolveBrowseSpaceId(args: {
  cloudId: string;
  accessToken: string;
  spaceId?: string;
  spaceKey?: string;
}): Promise<string | undefined> {
  const trimmedSpaceId = args.spaceId?.trim();
  if (trimmedSpaceId) {
    return Promise.resolve(trimmedSpaceId);
  }
  if (args.spaceKey?.trim()) {
    return resolveConfluenceSpaceId({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      spaceKey: args.spaceKey,
    });
  }
  return Promise.resolve(undefined);
}

export async function confluenceBrowseSpaces(args: {
  cloudId: string;
  accessToken: string;
  cursor?: string;
  limit?: number;
}): Promise<{ spaces: ConfluenceSpaceSummary[]; nextCursor?: string }> {
  const collected: ConfluenceSpaceSummary[] = [];
  let cursor = args.cursor;
  let nextCursor: string | undefined;
  const limit = Math.min(args.limit ?? 50, 50);

  while (collected.length < limit) {
    const batchLimit = limit - collected.length;
    const result = await confluenceListSpaces({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      cursor,
      limit: batchLimit,
    });
    collected.push(...result.spaces);
    nextCursor = result.nextCursor;
    if (!result.nextCursor || result.spaces.length === 0) {
      break;
    }
    cursor = result.nextCursor;
  }

  return {
    nextCursor,
    spaces: collected.slice(0, limit),
  };
}

export async function confluenceBrowsePages(args: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  query?: string;
  spaceId?: string;
  spaceKey?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ pages: ConfluencePageSummary[]; nextCursor?: string }> {
  const limit = Math.min(args.limit ?? 20, 50);
  const query = args.query?.trim() ?? "";
  const spaceId = await resolveBrowseSpaceId({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    spaceId: args.spaceId,
    spaceKey: args.spaceKey,
  });

  const collected: ConfluencePageSummary[] = [];
  let cursor = args.cursor;
  let nextCursor: string | undefined;
  const maxBatches = query ? MAX_TITLE_SEARCH_BATCHES : 1;

  for (let batch = 0; batch < maxBatches && collected.length < limit; batch++) {
    const result = await confluenceListPages({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      cursor,
      limit: query ? 50 : limit,
      spaceId,
      title: query || undefined,
    });

    let batchPages = result.pages
      .map((page) => toPageSummary(args.siteUrl, page))
      .filter((page): page is ConfluencePageSummary => page !== null);

    if (query) {
      batchPages = batchPages.filter((page) => titleMatches(page.title, query));
    }

    collected.push(...batchPages);
    nextCursor = result.nextCursor;
    if (!result.nextCursor) {
      break;
    }
    if (!query) {
      break;
    }
    cursor = result.nextCursor;
  }

  return {
    nextCursor,
    pages: collected.slice(0, limit),
  };
}

export async function confluenceGetPageContent(args: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  pageId: string;
  maxContentBytes?: number;
  maxContentMb?: number;
}): Promise<ConfluencePageContent> {
  const page = await confluenceGetPage({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    pageId: args.pageId,
  });
  const summary = toPageSummary(args.siteUrl, page);
  if (!summary) {
    throw new Error("Confluence page not found.");
  }
  const rawHtml = page.body?.storage?.value ?? "";
  const text = stripHtml(rawHtml);
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

export async function confluenceCanAccessPage(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
}): Promise<boolean> {
  const pageId = args.pageId.trim();
  if (!pageId) {
    return false;
  }
  try {
    await confluenceGetPage({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      pageId,
    });
    return true;
  } catch {
    return false;
  }
}
