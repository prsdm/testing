import { graphFetch } from "@/core/lib/connectors/providers/sharepoint/api";
import { parseSharePointCompositePageRef } from "@/core/lib/connectors/providers/sharepoint/page-id";

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

function pickBestSiteMatch(
  sites: Array<{ id?: string; displayName?: string; name?: string }>,
  siteName: string
) {
  const normalizedTarget = normalizeTitle(siteName);
  const exact = sites.filter(
    (site) =>
      normalizeTitle(site.displayName ?? site.name ?? "") === normalizedTarget
  );
  if (exact.length === 1 && exact[0].id) {
    return exact[0].id;
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple SharePoint sites match "${siteName}". Provide siteUrl or siteId instead.`
    );
  }

  const contains = sites.filter((site) => {
    const label = normalizeTitle(site.displayName ?? site.name ?? "");
    return label.includes(normalizedTarget) || normalizedTarget.includes(label);
  });
  if (contains.length === 1 && contains[0].id) {
    return contains[0].id;
  }
  if (contains.length > 1) {
    throw new Error(
      `Multiple SharePoint sites match "${siteName}". Provide siteUrl or siteId instead.`
    );
  }
  if (sites.length === 1 && sites[0].id) {
    return sites[0].id;
  }
  return null;
}

export async function resolveSharePointSiteId(input: {
  accessToken: string;
  siteId?: string;
  siteUrl?: string;
  siteName?: string;
}) {
  const trimmedId = input.siteId?.trim();
  if (trimmedId && !trimmedId.includes("://") && !trimmedId.includes("::")) {
    return { siteId: trimmedId };
  }

  const siteUrl = input.siteUrl?.trim();
  if (siteUrl) {
    const normalizedUrl = siteUrl.startsWith("https://")
      ? siteUrl
      : `https://${siteUrl}`;
    const url = new URL(normalizedUrl);
    const hostname = url.hostname;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const response = await graphFetch({
      accessToken: input.accessToken,
      path: `/sites/${encodeURIComponent(hostname)}:${encodeURIComponent(path)}?$select=id`,
    });
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) {
      throw new Error("SharePoint site not found for siteUrl.");
    }
    return { siteId: payload.id };
  }

  const siteName = input.siteName?.trim();
  if (siteName) {
    const response = await graphFetch({
      accessToken: input.accessToken,
      path: `/sites?search=${encodeURIComponent(siteName)}`,
    });
    const payload = (await response.json()) as {
      value?: Array<{ id?: string; displayName?: string; name?: string }>;
    };
    const siteId = pickBestSiteMatch(payload.value ?? [], siteName);
    if (!siteId) {
      throw new Error(`No SharePoint site found for "${siteName}".`);
    }
    return { siteId };
  }

  throw new Error("siteId, siteUrl, or siteName is required.");
}

export function resolveSharePointSiteContext(input: {
  accessToken: string;
  siteId?: string;
  siteUrl?: string;
  siteName?: string;
  pageId?: string;
}): Promise<{ siteId: string }> {
  const composite = input.pageId
    ? parseSharePointCompositePageRef(input.pageId)
    : null;
  if (composite) {
    return Promise.resolve({ siteId: composite.siteId });
  }
  return resolveSharePointSiteId({
    accessToken: input.accessToken,
    siteId: input.siteId,
    siteName: input.siteName,
    siteUrl: input.siteUrl,
  });
}
