import {
  buildConfluencePageLink,
  confluenceListPages,
  confluenceListSpaces,
} from "@/core/lib/connectors/providers/confluence/api";
import type {
  ConfluencePageSummary,
  ConfluenceSpaceSummary,
} from "@/core/lib/connectors/providers/confluence/read";
import { driveBrowseFiles } from "@/core/lib/connectors/providers/google-drive/read";
import type { DriveFileSummary } from "@/core/lib/connectors/providers/google-drive/types";
import type { NotionDatabaseSummary } from "@/core/lib/connectors/providers/notion/browse-databases";
import { notionBrowseDatabases } from "@/core/lib/connectors/providers/notion/browse-databases";
import type { NotionPageSummary } from "@/core/lib/connectors/providers/notion/read";
import { notionBrowsePages } from "@/core/lib/connectors/providers/notion/read";
import { graphFetch } from "@/core/lib/connectors/providers/sharepoint/api";
import type { SharePointPageSummary } from "@/core/lib/connectors/providers/sharepoint/read";
import { listSlackChannelsForIndex } from "@/core/lib/search/index-slack-messages";

const CONFLUENCE_BATCH_SIZE = 50;
const DRIVE_BATCH_SIZE = 50;
const NOTION_BATCH_SIZE = 100;
const GRAPH_BATCH_SIZE = 100;

function graphPathFromNextLink(nextLink: string) {
  const url = new URL(nextLink);
  return `${url.pathname.replace(/^\/v1\.0/, "")}${url.search}`;
}

function toConfluencePageSummary(
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
  return {
    link: buildConfluencePageLink({
      pageId: page.id,
      siteUrl,
      webUi: page._links?.webui,
    }),
    modifiedTime: page.version?.when ?? page.version?.createdAt,
    pageId: page.id,
    title: page.title ?? "Untitled",
  };
}

async function paginateConfluenceSpaces(args: {
  cloudId: string;
  accessToken: string;
}): Promise<ConfluenceSpaceSummary[]> {
  const spaces: ConfluenceSpaceSummary[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await confluenceListSpaces({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      cursor,
      limit: CONFLUENCE_BATCH_SIZE,
    });
    spaces.push(...batch.spaces);
    if (!batch.nextCursor) {
      break;
    }
    cursor = batch.nextCursor;
  }

  return spaces;
}

async function paginateConfluencePagesInSpace(args: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
  spaceId: string;
}): Promise<ConfluencePageSummary[]> {
  const pages: ConfluencePageSummary[] = [];
  let cursor: string | undefined;

  while (true) {
    const batch = await confluenceListPages({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      cursor,
      limit: CONFLUENCE_BATCH_SIZE,
      spaceId: args.spaceId,
    });
    for (const page of batch.pages) {
      const summary = toConfluencePageSummary(args.siteUrl, page);
      if (summary) {
        pages.push(summary);
      }
    }
    if (!batch.nextCursor) {
      break;
    }
    cursor = batch.nextCursor;
  }

  return pages;
}

export async function catalogFetchAllConfluencePages(args: {
  siteUrl: string;
  cloudId: string;
  accessToken: string;
}): Promise<
  Array<{ space: ConfluenceSpaceSummary; pages: ConfluencePageSummary[] }>
> {
  const spaces = await paginateConfluenceSpaces({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
  });

  return Promise.all(
    spaces.map(async (space) => {
      const pages = await paginateConfluencePagesInSpace({
        accessToken: args.accessToken,
        cloudId: args.cloudId,
        siteUrl: args.siteUrl,
        spaceId: space.spaceId,
      }).catch(() => []);
      return { pages, space };
    })
  );
}

export async function catalogFetchAllDriveFiles(args: {
  tenantId: string;
  accessToken: string;
}): Promise<DriveFileSummary[]> {
  const files: DriveFileSummary[] = [];
  let pageToken: string | undefined;

  while (true) {
    const batch = await driveBrowseFiles({
      accessToken: args.accessToken,
      limit: DRIVE_BATCH_SIZE,
      pageToken,
      tenantId: args.tenantId,
    });
    files.push(...batch.files);
    if (!batch.nextPageToken) {
      break;
    }
    pageToken = batch.nextPageToken;
  }

  return files;
}

async function paginateNotionPages(args: {
  accessToken: string;
}): Promise<NotionPageSummary[]> {
  const pages: NotionPageSummary[] = [];
  let startCursor: string | undefined;

  while (true) {
    const batch = await notionBrowsePages({
      accessToken: args.accessToken,
      limit: NOTION_BATCH_SIZE,
      startCursor,
    });
    pages.push(...batch.pages);
    if (!batch.nextCursor) {
      break;
    }
    startCursor = batch.nextCursor;
  }

  return pages;
}

async function paginateNotionDatabases(args: {
  accessToken: string;
}): Promise<NotionDatabaseSummary[]> {
  const databases: NotionDatabaseSummary[] = [];
  const seen = new Set<string>();
  let startCursor: string | undefined;

  while (true) {
    const batch = await notionBrowseDatabases({
      accessToken: args.accessToken,
      limit: NOTION_BATCH_SIZE,
      startCursor,
    });
    for (const database of batch.databases) {
      if (seen.has(database.databaseId)) {
        continue;
      }
      seen.add(database.databaseId);
      databases.push(database);
    }
    if (!batch.nextCursor) {
      break;
    }
    startCursor = batch.nextCursor;
  }

  return databases;
}

export async function catalogFetchAllNotionItems(args: {
  accessToken: string;
}): Promise<{
  pages: NotionPageSummary[];
  databases: NotionDatabaseSummary[];
}> {
  const [pages, databases] = await Promise.all([
    paginateNotionPages(args),
    paginateNotionDatabases(args),
  ]);
  return { databases, pages };
}

type SharePointSiteRef = {
  siteId: string;
  siteName?: string;
};

type SharePointPageRecord = {
  id?: string;
  name?: string;
  title?: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
};

function toSharePointPageSummary(
  site: SharePointSiteRef,
  page: SharePointPageRecord
): SharePointPageSummary | null {
  if (!page.id || !page.webUrl) {
    return null;
  }
  return {
    link: page.webUrl,
    modifiedTime: page.lastModifiedDateTime,
    pageId: page.id,
    siteId: site.siteId,
    siteName: site.siteName,
    title: (page.title ?? page.name ?? "Untitled").trim() || "Untitled",
  };
}

async function paginateSharePointSites(args: {
  accessToken: string;
}): Promise<SharePointSiteRef[]> {
  const sites: SharePointSiteRef[] = [];
  let path = `/sites?search=${encodeURIComponent("*")}&$top=${GRAPH_BATCH_SIZE}`;

  while (true) {
    const response = await graphFetch({
      accessToken: args.accessToken,
      path,
    });
    const payload = (await response.json()) as {
      value?: Array<{ id?: string; displayName?: string; name?: string }>;
      "@odata.nextLink"?: string;
    };
    for (const site of payload.value ?? []) {
      if (!site.id) {
        continue;
      }
      sites.push({
        siteId: site.id,
        siteName: site.displayName?.trim() || site.name?.trim() || undefined,
      });
    }
    if (!payload["@odata.nextLink"]) {
      break;
    }
    path = graphPathFromNextLink(payload["@odata.nextLink"]);
  }

  return sites;
}

async function paginateSharePointPagesInSite(args: {
  accessToken: string;
  siteId: string;
}): Promise<SharePointPageRecord[]> {
  const pages: SharePointPageRecord[] = [];
  let path =
    `/sites/${encodeURIComponent(args.siteId)}/pages/microsoft.graph.sitePage` +
    `?$top=${GRAPH_BATCH_SIZE}&$select=id,name,title,webUrl,lastModifiedDateTime`;

  while (true) {
    const response = await graphFetch({
      accessToken: args.accessToken,
      path,
    });
    const payload = (await response.json()) as {
      value?: SharePointPageRecord[];
      "@odata.nextLink"?: string;
    };
    pages.push(...(payload.value ?? []));
    if (!payload["@odata.nextLink"]) {
      break;
    }
    path = graphPathFromNextLink(payload["@odata.nextLink"]);
  }

  return pages;
}

export async function catalogFetchAllSharePointPages(args: {
  accessToken: string;
}): Promise<SharePointPageSummary[]> {
  const sites = await paginateSharePointSites(args);
  const pagesBySite = await Promise.all(
    sites.map(async (site) => {
      const pages = await paginateSharePointPagesInSite({
        accessToken: args.accessToken,
        siteId: site.siteId,
      }).catch(() => []);
      return pages.reduce<SharePointPageSummary[]>((acc, page) => {
        const summary = toSharePointPageSummary(site, page);
        if (summary) {
          acc.push(summary);
        }
        return acc;
      }, []);
    })
  );
  return pagesBySite.flat();
}

export type SlackCatalogChannel = {
  channelId: string;
  name: string;
  isPrivate: boolean;
  link: string | null;
};

/** Channels only (public + private). No DMs / MPIMs. */
export async function catalogFetchAllSlackChannels(args: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
}): Promise<SlackCatalogChannel[]> {
  const channels = await listSlackChannelsForIndex({
    accessToken: args.accessToken,
    includePrivate: true,
    tenantId: args.tenantId,
  });
  const base = args.teamUrl?.replace(/\/$/, "") ?? null;
  return channels.map((channel) => ({
    channelId: channel.id,
    isPrivate: channel.isPrivate,
    link: base ? `${base}/archives/${channel.id}` : null,
    name: channel.name,
  }));
}
