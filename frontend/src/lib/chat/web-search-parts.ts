import type { ChatMessage } from "@/shared/types";

export type WebSource =
  | { type: "url"; url: string; title?: string }
  | { type: "api"; name: string };

export type WebSourceDetail = {
  title?: string;
  snippet?: string;
  publishedAt?: string;
  ageLabel?: string;
};

const WEB_TOOL_PART_TYPES = new Set(["tool-webSearch", "tool-openUrl"]);

export function normalizeWebQueryForDisplay(query: string) {
  const cleaned = query
    .replace(/\bsite:[^\s)]+/gi, " ")
    .replace(/\b(?:AND|OR|NOT)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : query;
}

export function webSourceKey(source: WebSource) {
  return source.type === "url" ? `url:${source.url}` : `api:${source.name}`;
}

export function webSourceLabel(source: WebSource) {
  if (source.type === "url") {
    return getWebSourceDisplayTitle(source.url, source.title);
  }
  return source.name;
}

function isHostnameLikeTitle(title: string, url: string) {
  try {
    const hostname = new URL(url).hostname;
    const normalizedTitle = title.replace(/^www\./, "").trim();
    const normalizedHost = hostname.replace(/^www\./, "");
    return normalizedTitle === normalizedHost || normalizedTitle === hostname;
  } catch {
    return false;
  }
}

function humanizePathSegment(segment: string) {
  return decodeURIComponent(segment)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export function getUrlPathSlug(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split("/")
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      const suffix = `${parsed.pathname}${parsed.search}`.replace(/\/$/, "");
      return suffix.length > 1
        ? `${parsed.hostname}${suffix}`
        : parsed.hostname;
    }

    const lastSegment = humanizePathSegment(segments.at(-1) ?? "");
    if (lastSegment.length > 2 && !/^\d+$/.test(lastSegment)) {
      return lastSegment;
    }

    const pathTail = segments
      .slice(-2)
      .map((segment) => humanizePathSegment(segment))
      .filter(Boolean)
      .join(" / ");

    if (pathTail.length > 0) {
      return pathTail;
    }

    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "Web source";
  }
}

export function getWebSourceDisplayTitle(url: string, title?: string) {
  const trimmedTitle = title?.trim();
  if (trimmedTitle && !isHostnameLikeTitle(trimmedTitle, url)) {
    return trimmedTitle;
  }
  return getUrlPathSlug(url);
}

function getStringField(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOutputRecord(
  part: ChatMessage["parts"][number]
): Record<string, unknown> | null {
  if (
    "state" in part &&
    part.state === "output-available" &&
    "output" in part &&
    part.output &&
    typeof part.output === "object"
  ) {
    return part.output as Record<string, unknown>;
  }
  return null;
}

function getResultRecords(
  output: Record<string, unknown> | null
): Record<string, unknown>[] {
  if (!output) {
    return [];
  }
  const results = output.results;
  if (!Array.isArray(results)) {
    return [];
  }
  return results.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
}

function pickLongerSnippet(left?: string, right?: string) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left.length >= right.length ? left : right;
}

function mergeWebSourceDetail(
  detailsByUrl: Map<string, WebSourceDetail>,
  url: string,
  patch: WebSourceDetail
) {
  const existing = detailsByUrl.get(url) ?? {};
  detailsByUrl.set(url, {
    ageLabel: existing.ageLabel ?? patch.ageLabel,
    publishedAt: existing.publishedAt ?? patch.publishedAt,
    snippet: pickLongerSnippet(existing.snippet, patch.snippet),
    title: existing.title ?? patch.title,
  });
}

export function extractWebQueriesFromPart(
  part: ChatMessage["parts"][number]
): string[] {
  if (part.type !== "tool-webSearch") {
    return [];
  }

  const queries: string[] = [];

  const pushQuery = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }
    const display = normalizeWebQueryForDisplay(value);
    if (display.length > 0 && !queries.includes(display)) {
      queries.push(display);
    }
  };

  const collectFrom = (record: Record<string, unknown> | undefined) => {
    if (!record) {
      return;
    }
    if (Array.isArray(record.queries)) {
      for (const query of record.queries) {
        pushQuery(query);
      }
    }
    pushQuery(record.query);
  };

  if ("input" in part && part.input && typeof part.input === "object") {
    collectFrom(part.input as Record<string, unknown>);
  }

  const output = getOutputRecord(part);
  if (output) {
    collectFrom(output);
  }

  return queries;
}

export function extractWebQueries(parts: ChatMessage["parts"]): string[] {
  const queries: string[] = [];
  for (const part of parts) {
    for (const query of extractWebQueriesFromPart(part)) {
      if (!queries.includes(query)) {
        queries.push(query);
      }
    }
  }
  return queries;
}

function addUrlSource(
  byUrl: Map<string, WebSource>,
  record: Record<string, unknown>
) {
  const url = getStringField(record, "url");
  if (!url) {
    return;
  }
  const key = `url:${url}`;
  if (!byUrl.has(key)) {
    byUrl.set(key, {
      title: getStringField(record, "title"),
      type: "url",
      url,
    });
  }
}

export function extractWebSourcesFromPart(
  part: ChatMessage["parts"][number]
): WebSource[] {
  if (!WEB_TOOL_PART_TYPES.has(part.type)) {
    return [];
  }

  const byUrl = new Map<string, WebSource>();
  for (const record of getResultRecords(getOutputRecord(part))) {
    addUrlSource(byUrl, record);
  }
  return [...byUrl.values()];
}

export function extractReadWebSourcesFromPart(
  part: ChatMessage["parts"][number]
): WebSource[] {
  if (part.type !== "tool-webSearch") {
    return [];
  }

  const output = getOutputRecord(part);
  if (!output) {
    return [];
  }

  const readUrls = output.readUrls;
  if (!Array.isArray(readUrls) || readUrls.length === 0) {
    return [];
  }

  const titleByUrl = new Map<string, string>();
  for (const record of getResultRecords(output)) {
    const url = getStringField(record, "url");
    const title = getStringField(record, "title");
    if (url && title) {
      titleByUrl.set(url, title);
    }
  }

  return readUrls
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .map((url) => ({
      title: titleByUrl.get(url),
      type: "url" as const,
      url,
    }));
}

export function extractWebSources(parts: ChatMessage["parts"]): WebSource[] {
  const byUrl = new Map<string, WebSource>();
  for (const part of parts) {
    for (const source of extractWebSourcesFromPart(part)) {
      byUrl.set(webSourceKey(source), source);
    }
  }
  return [...byUrl.values()];
}

export function getDirectSourceWebSources(
  parts: ChatMessage["parts"]
): WebSource[] {
  return parts.flatMap((part) =>
    part.type === "source-url"
      ? [{ title: part.title, type: "url" as const, url: part.url }]
      : []
  );
}

export function getRenderedWebSources(
  parts: ChatMessage["parts"]
): WebSource[] {
  const webSources = extractWebSources(parts);
  if (webSources.length > 0) {
    return webSources;
  }
  return getDirectSourceWebSources(parts);
}

export function hasPendingWebSearch(parts: ChatMessage["parts"]) {
  return parts.some(
    (part) =>
      WEB_TOOL_PART_TYPES.has(part.type) &&
      "state" in part &&
      (part.state === "input-available" || part.state === "input-streaming")
  );
}

export function hasWebSearchActivity(parts: ChatMessage["parts"]) {
  return (
    extractWebQueries(parts).length > 0 ||
    getRenderedWebSources(parts).length > 0 ||
    hasPendingWebSearch(parts)
  );
}

export function extractWebSourceDetails(parts: ChatMessage["parts"]) {
  const detailsByUrl = new Map<string, WebSourceDetail>();

  for (const part of parts) {
    if (!WEB_TOOL_PART_TYPES.has(part.type)) {
      continue;
    }
    for (const record of getResultRecords(getOutputRecord(part))) {
      const url = getStringField(record, "url");
      if (!url) {
        continue;
      }
      mergeWebSourceDetail(detailsByUrl, url, {
        snippet: getStringField(record, "snippet"),
        title: getStringField(record, "title"),
      });
    }
  }

  return detailsByUrl;
}
