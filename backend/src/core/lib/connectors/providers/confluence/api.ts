import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";

export type ConfluencePageRecord = {
  id?: string;
  title?: string;
  version?: { number?: number; when?: string; createdAt?: string };
  _links?: { webui?: string; base?: string };
  body?: { storage?: { value?: string } };
  parentId?: string;
};

type ConfluenceV2Page = {
  id?: string;
  title?: string;
  status?: string;
  spaceId?: string;
  parentId?: string;
  version?: { number?: number; when?: string; createdAt?: string };
  _links?: { webui?: string; base?: string };
  body?: {
    storage?: { value?: string; representation?: string };
  };
};

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.trim().replace(/\/+$/, "");
}

function normalizeV2Page(page: ConfluenceV2Page): ConfluencePageRecord {
  return {
    _links: page._links,
    body: page.body?.storage
      ? { storage: { value: page.body.storage.value } }
      : undefined,
    id: page.id,
    parentId: page.parentId,
    title: page.title,
    version: page.version,
  };
}

export function buildConfluencePageLink(args: {
  siteUrl: string;
  webUi?: string;
  pageId: string;
}) {
  if (args.webUi?.startsWith("http")) {
    return normalizeAtlassianSourceLink(args.webUi);
  }

  const site = new URL(normalizeSiteUrl(args.siteUrl));
  const origin = site.origin;

  if (args.webUi?.startsWith("/")) {
    if (args.webUi.startsWith("/wiki/")) {
      return `${origin}${args.webUi}`;
    }
    return `${origin}/wiki${args.webUi}`;
  }

  if (args.webUi) {
    const relative = args.webUi.replace(/^\/+/, "");
    return `${origin}/wiki/${relative}`;
  }

  return `${origin}/wiki/pages/${encodeURIComponent(args.pageId)}`;
}

export async function confluenceFetch(args: {
  cloudId: string;
  path: string;
  accessToken: string;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
}) {
  const response = await fetch(
    `https://api.atlassian.com/ex/confluence/${encodeURIComponent(args.cloudId)}${args.path}`,
    {
      body: args.body ? JSON.stringify(args.body) : undefined,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.accessToken}`,
        ...(args.body ? { "content-type": "application/json" } : {}),
      },
      method: args.method ?? "GET",
    }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Confluence API ${args.path} failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  return response;
}

type ConfluenceV2ListResponse = {
  results?: ConfluenceV2Page[];
  _links?: { next?: string };
};

function parseV2NextCursor(nextLink?: string): string | undefined {
  if (!nextLink) {
    return undefined;
  }
  try {
    return new URL(nextLink).searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

type ConfluenceV2Space = {
  id?: string;
  key?: string;
  name?: string;
  homepageId?: string;
};

type ConfluenceV2SpaceListResponse = {
  results?: ConfluenceV2Space[];
  _links?: { next?: string };
};

export type ConfluenceSpaceRecord = {
  spaceId: string;
  key: string;
  name: string;
  homepageId?: string;
};

export async function confluenceListSpaces(args: {
  cloudId: string;
  accessToken: string;
  cursor?: string;
  limit?: number;
}): Promise<{
  spaces: ConfluenceSpaceRecord[];
  nextCursor?: string;
}> {
  const limit = Math.min(args.limit ?? 50, 50);
  const params = new URLSearchParams({
    limit: String(limit),
    status: "current",
  });
  if (args.cursor) {
    params.set("cursor", args.cursor);
  }
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/api/v2/spaces?${params.toString()}`,
  });
  const payload = (await response.json()) as ConfluenceV2SpaceListResponse;
  const spaces = (payload.results ?? [])
    .filter((space): space is ConfluenceV2Space & { id: string; key: string } =>
      Boolean(space.id && space.key)
    )
    .map((space) => ({
      homepageId: space.homepageId,
      key: space.key,
      name: space.name?.trim() || space.key,
      spaceId: space.id,
    }));
  return {
    nextCursor: parseV2NextCursor(payload._links?.next),
    spaces,
  };
}

export async function confluenceListPages(args: {
  cloudId: string;
  accessToken: string;
  spaceId?: string;
  title?: string;
  cursor?: string;
  limit?: number;
}): Promise<{
  pages: ConfluencePageRecord[];
  nextCursor?: string;
}> {
  const limit = Math.min(args.limit ?? 25, 50);
  const params = new URLSearchParams({
    limit: String(limit),
    status: "current",
  });
  if (args.cursor) {
    params.set("cursor", args.cursor);
  }
  if (args.title?.trim()) {
    params.set("title", args.title.trim());
  }
  const query = params.toString();
  const path = args.spaceId
    ? `/wiki/api/v2/spaces/${encodeURIComponent(args.spaceId)}/pages?${query}`
    : `/wiki/api/v2/pages?${query}`;
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path,
  });
  const payload = (await response.json()) as ConfluenceV2ListResponse;
  return {
    nextCursor: parseV2NextCursor(payload._links?.next),
    pages: (payload.results ?? []).map(normalizeV2Page),
  };
}

export async function resolveConfluenceSpaceId(args: {
  cloudId: string;
  accessToken: string;
  spaceKey: string;
}): Promise<string> {
  const spaceKey = args.spaceKey.trim();
  if (!spaceKey) {
    throw new Error("spaceKey is required.");
  }
  const params = new URLSearchParams({
    keys: spaceKey,
    limit: "1",
  });
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/api/v2/spaces?${params.toString()}`,
  });
  const payload = (await response.json()) as {
    results?: Array<{ id?: string; key?: string }>;
  };
  const space = payload.results?.at(0);
  if (!space?.id) {
    throw new Error(`Confluence space "${spaceKey}" not found.`);
  }
  return space.id;
}

export async function confluenceGetPage(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
}): Promise<ConfluencePageRecord> {
  const params = new URLSearchParams({
    "body-format": "storage",
  });
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/api/v2/pages/${encodeURIComponent(args.pageId.trim())}?${params.toString()}`,
  });
  const page = (await response.json()) as ConfluenceV2Page;
  return normalizeV2Page(page);
}

export async function confluenceGetPageMetadata(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
}): Promise<{ spaceId?: string }> {
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    path: `/wiki/api/v2/pages/${encodeURIComponent(args.pageId.trim())}`,
  });
  const page = (await response.json()) as ConfluenceV2Page;
  return { spaceId: page.spaceId?.trim() || undefined };
}

export async function confluencePostPage(args: {
  cloudId: string;
  accessToken: string;
  spaceId: string;
  title: string;
  storageHtml: string;
  parentId?: string;
}): Promise<ConfluencePageRecord> {
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    body: {
      spaceId: args.spaceId,
      status: "current",
      title: args.title,
      ...(args.parentId ? { parentId: args.parentId } : {}),
      body: {
        representation: "storage",
        value: args.storageHtml,
      },
    },
    cloudId: args.cloudId,
    method: "POST",
    path: "/wiki/api/v2/pages",
  });
  const page = (await response.json()) as ConfluenceV2Page;
  return normalizeV2Page(page);
}

export async function confluencePutPage(args: {
  cloudId: string;
  accessToken: string;
  pageId: string;
  title: string;
  versionNumber: number;
  storageHtml: string;
  parentId?: string;
}): Promise<ConfluencePageRecord> {
  const response = await confluenceFetch({
    accessToken: args.accessToken,
    body: {
      id: args.pageId,
      status: "current",
      title: args.title,
      ...(args.parentId ? { parentId: args.parentId } : {}),
      body: {
        representation: "storage",
        value: args.storageHtml,
      },
      version: {
        number: args.versionNumber,
      },
    },
    cloudId: args.cloudId,
    method: "PUT",
    path: `/wiki/api/v2/pages/${encodeURIComponent(args.pageId)}`,
  });
  const page = (await response.json()) as ConfluenceV2Page;
  return normalizeV2Page(page);
}

type ConfluenceV2CreatedSpace = {
  id?: string;
  key?: string;
  name?: string;
  _links?: { webui?: string; base?: string };
};

export async function confluencePostSpace(args: {
  cloudId: string;
  accessToken: string;
  spaceKey: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}): Promise<ConfluenceV2CreatedSpace> {
  const body: Record<string, unknown> = {
    key: args.spaceKey,
    name: args.name,
  };
  if (args.description?.trim()) {
    body.description = {
      representation: "plain",
      value: args.description.trim(),
    };
  }
  if (args.isPrivate) {
    body.createPrivateSpace = true;
  }

  const response = await confluenceFetch({
    accessToken: args.accessToken,
    body,
    cloudId: args.cloudId,
    method: "POST",
    path: "/wiki/api/v2/spaces",
  });
  return (await response.json()) as ConfluenceV2CreatedSpace;
}

export function confluencePageResult(args: {
  siteUrl: string;
  page: ConfluencePageRecord;
  fallbackPageId: string;
  fallbackTitle: string;
}) {
  const pageId = args.page.id ?? args.fallbackPageId;
  const title = args.page.title ?? args.fallbackTitle;
  const link = buildConfluencePageLink({
    pageId,
    siteUrl: args.siteUrl,
    webUi: args.page._links?.webui,
  });
  return { link, pageId, title };
}
