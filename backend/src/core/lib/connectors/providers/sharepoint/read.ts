import { graphFetch } from "@/core/lib/connectors/providers/sharepoint/api";
import { resolveReadableContent } from "@/core/lib/sources/index-content-limits";

export type SharePointPageSummary = {
  siteId: string;
  siteName?: string;
  pageId: string;
  title: string;
  link: string;
  modifiedTime?: string;
};

export type SharePointPageContent = SharePointPageSummary & {
  content: string;
  truncated: boolean;
};

type SharePointPage = {
  id?: string;
  name?: string;
  title?: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
};

function sanitizeText(input: string) {
  return input
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&#39;/g, "'")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function toPageSummary(
  siteId: string,
  siteName: string | undefined,
  page: SharePointPage
) {
  if (!page.id || !page.webUrl) {
    return null;
  }
  return {
    link: page.webUrl,
    modifiedTime: page.lastModifiedDateTime,
    pageId: page.id,
    siteId,
    siteName,
    title: (page.title ?? page.name ?? "Untitled").trim() || "Untitled",
  } satisfies SharePointPageSummary;
}

async function listSitePages(args: {
  accessToken: string;
  siteId: string;
  query?: string;
  limit: number;
}) {
  const escapedQuery = args.query?.replaceAll("'", "''");
  const params = new URLSearchParams({
    $select: "id,name,title,webUrl,lastModifiedDateTime",
    $top: String(args.limit),
  });
  if (escapedQuery) {
    params.set(
      "$filter",
      `contains(tolower(name),'${escapedQuery.toLowerCase()}')`
    );
  }
  const response = await graphFetch({
    accessToken: args.accessToken,
    path: `/sites/${encodeURIComponent(args.siteId)}/pages/microsoft.graph.sitePage?${params.toString()}`,
  });
  const payload = (await response.json()) as {
    value?: SharePointPage[];
  };
  return payload.value ?? [];
}

export async function sharePointBrowsePages(args: {
  accessToken: string;
  query?: string;
  limit?: number;
}): Promise<{ pages: SharePointPageSummary[] }> {
  const limit = Math.min(args.limit ?? 20, 50);
  const encodedQuery = encodeURIComponent(args.query?.trim() || "*");
  const sitesResponse = await graphFetch({
    accessToken: args.accessToken,
    path: `/sites?search=${encodedQuery}`,
  });
  const sitesPayload = (await sitesResponse.json()) as {
    value?: Array<{ id?: string; displayName?: string; name?: string }>;
  };
  const sites = (sitesPayload.value ?? [])
    .flatMap((site) => {
      if (!site.id) {
        return [];
      }
      return [
        {
          siteId: site.id,
          siteName: site.displayName?.trim() || site.name?.trim() || undefined,
        },
      ];
    })
    .slice(0, 5);

  const pagesBySite = await Promise.all(
    sites.map(async ({ siteId, siteName }) => {
      const pages = await listSitePages({
        accessToken: args.accessToken,
        limit,
        query: args.query?.trim() || undefined,
        siteId,
      }).catch(() => []);
      return pages.reduce<SharePointPageSummary[]>((acc, page) => {
        const summary = toPageSummary(siteId, siteName, page);
        if (summary) {
          acc.push(summary);
        }
        return acc;
      }, []);
    })
  );

  const pages = pagesBySite
    .flat()
    .sort((a, b) => {
      const aTime = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const bTime = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);

  return { pages };
}

export async function sharePointBrowsePagesInSite(args: {
  accessToken: string;
  siteId: string;
  query?: string;
  limit?: number;
}): Promise<{ pages: SharePointPageSummary[] }> {
  const limit = Math.min(args.limit ?? 20, 50);
  const pages = await listSitePages({
    accessToken: args.accessToken,
    limit,
    query: args.query?.trim() || undefined,
    siteId: args.siteId,
  }).catch(() => []);
  const summaries = pages.reduce<SharePointPageSummary[]>((acc, page) => {
    const summary = toPageSummary(args.siteId, undefined, page);
    if (summary) {
      acc.push(summary);
    }
    return acc;
  }, []);
  return { pages: summaries };
}

function extractCanvasText(payload: Record<string, unknown>) {
  const parts: string[] = [];
  const title = typeof payload.title === "string" ? payload.title : "";
  if (title) {
    parts.push(title);
  }

  const titleArea = payload.titleArea;
  if (titleArea && typeof titleArea === "object") {
    const text = (titleArea as { text?: string }).text;
    if (typeof text === "string" && text.trim()) {
      parts.push(sanitizeText(text));
    }
  }

  const layout = payload.canvasLayout;
  if (layout && typeof layout === "object") {
    const sections = (layout as { horizontalSections?: unknown[] })
      .horizontalSections;
    if (Array.isArray(sections)) {
      for (const section of sections) {
        if (!section || typeof section !== "object") {
          continue;
        }
        const columns = (section as { columns?: unknown[] }).columns;
        if (!Array.isArray(columns)) {
          continue;
        }
        for (const column of columns) {
          if (!column || typeof column !== "object") {
            continue;
          }
          const webparts = (column as { webparts?: unknown[] }).webparts;
          if (!Array.isArray(webparts)) {
            continue;
          }
          for (const webpart of webparts) {
            if (!webpart || typeof webpart !== "object") {
              continue;
            }
            const data = (webpart as { data?: unknown }).data;
            if (!data || typeof data !== "object") {
              continue;
            }
            const html = (data as { innerHtml?: string }).innerHtml;
            if (typeof html === "string" && html.trim()) {
              parts.push(sanitizeText(html));
            }
          }
        }
      }
    }
  }

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

export async function sharePointGetPageContent(args: {
  accessToken: string;
  siteId: string;
  pageId: string;
  maxContentBytes?: number;
  maxContentMb?: number;
}): Promise<SharePointPageContent> {
  const response = await graphFetch({
    accessToken: args.accessToken,
    path: `/sites/${encodeURIComponent(args.siteId)}/pages/${encodeURIComponent(args.pageId)}/microsoft.graph.sitePage?$expand=canvasLayout`,
  });
  const payload = (await response.json()) as Record<string, unknown>;

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "Untitled";
  const link = typeof payload.webUrl === "string" ? payload.webUrl : "";
  if (!link) {
    throw new Error("SharePoint page URL not found.");
  }

  const content = extractCanvasText(payload).trim();
  const { content: resolvedContent, truncated } = resolveReadableContent(
    content,
    args.maxContentBytes === undefined
      ? undefined
      : {
          maxContentBytes: args.maxContentBytes,
          maxContentMb: args.maxContentMb,
        }
  );
  return {
    content: resolvedContent,
    link,
    modifiedTime:
      typeof payload.lastModifiedDateTime === "string"
        ? payload.lastModifiedDateTime
        : undefined,
    pageId: args.pageId,
    siteId: args.siteId,
    title,
    truncated,
  };
}

export async function sharePointCanAccessPage(args: {
  accessToken: string;
  siteId: string;
  pageId: string;
}): Promise<boolean> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(args.siteId)}/pages/${encodeURIComponent(args.pageId)}/microsoft.graph.sitePage`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.accessToken}`,
      },
    }
  ).catch(() => null);

  return Boolean(response?.ok);
}
