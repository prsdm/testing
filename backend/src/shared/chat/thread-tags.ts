import { z } from "zod";

export const THREAD_TAG_MAX_COUNT = 4;
export const CHANNEL_THREAD_TAG_CATALOG_MAX = 10;
export const THREAD_TAG_MAX_LENGTH = 10;
export const THREAD_TITLE_MAX_LENGTH = 120;

export function normalizeThreadTitle(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > THREAD_TITLE_MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

export const THREAD_TAG_COLOR_IDS = [
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;

export type ThreadTagColorId = (typeof THREAD_TAG_COLOR_IDS)[number];

export const threadTagColorIdSchema = z.enum(THREAD_TAG_COLOR_IDS);

export const threadTagSchema = z.object({
  color: threadTagColorIdSchema.default("default"),
  label: z.string().min(1).max(THREAD_TAG_MAX_LENGTH),
});

export type ThreadTag = z.infer<typeof threadTagSchema>;

export const threadTagsSchema = z
  .array(threadTagSchema)
  .max(THREAD_TAG_MAX_COUNT);

export const channelThreadTagCatalogSchema = z
  .array(threadTagSchema)
  .max(CHANNEL_THREAD_TAG_CATALOG_MAX);

export function readMessageThreadTags(
  metadata:
    | ({ threadTags?: unknown; threadTopics?: unknown } & Record<
        string,
        unknown
      >)
    | null
    | undefined
): ThreadTag[] {
  if (!metadata) {
    return [];
  }
  const legacy = metadata.threadTopics;
  const raw = metadata.threadTags === undefined ? legacy : metadata.threadTags;
  return parseThreadTags(raw);
}

export function normalizeThreadTagLabel(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > THREAD_TAG_MAX_LENGTH) {
    return null;
  }
  return trimmed;
}

function defaultColorForLabel(label: string): ThreadTagColorId {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0;
  }
  return (
    THREAD_TAG_COLOR_IDS[Math.abs(hash) % THREAD_TAG_COLOR_IDS.length] ??
    "default"
  );
}

function parseThreadTagColor(raw: unknown): ThreadTagColorId | null {
  const parsed = threadTagColorIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function collectThreadTagsFromRaw(raw: unknown): ThreadTag[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: ThreadTag[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const label = normalizeThreadTagLabel(entry);
      if (label) {
        items.push({ color: defaultColorForLabel(label), label });
      }
      continue;
    }
    if (entry && typeof entry === "object" && "label" in entry) {
      const record = entry as { label?: unknown; color?: unknown };
      const label = normalizeThreadTagLabel(String(record.label ?? ""));
      if (!label) {
        continue;
      }
      const color =
        parseThreadTagColor(record.color) ?? defaultColorForLabel(label);
      items.push({ color, label });
    }
  }

  return items;
}

export function parseThreadTags(raw: unknown): ThreadTag[] {
  return normalizeThreadTags(collectThreadTagsFromRaw(raw));
}

export function normalizeThreadTags(raw: ThreadTag[]): ThreadTag[] {
  return normalizeThreadTagList(raw, THREAD_TAG_MAX_COUNT);
}

export function normalizeChannelThreadTagCatalog(
  raw: ThreadTag[]
): ThreadTag[] {
  return normalizeThreadTagList(raw, CHANNEL_THREAD_TAG_CATALOG_MAX);
}

function normalizeThreadTagList(
  raw: ThreadTag[],
  maxCount: number
): ThreadTag[] {
  const seen = new Set<string>();
  const result: ThreadTag[] = [];
  for (const item of raw) {
    const label = normalizeThreadTagLabel(item.label);
    if (!label) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const color = parseThreadTagColor(item.color) ?? "default";
    result.push({ color, label });
    if (result.length >= maxCount) {
      break;
    }
  }
  return result;
}

export function parseChannelThreadTagCatalog(raw: unknown): ThreadTag[] {
  return normalizeChannelThreadTagCatalog(collectThreadTagsFromRaw(raw));
}

export function resolveThreadTagsAgainstCatalog(
  assigned: ThreadTag[],
  catalog: ThreadTag[]
): ThreadTag[] {
  const catalogByKey = new Map(
    catalog.map((topic) => [topic.label.toLowerCase(), topic] as const)
  );
  const result: ThreadTag[] = [];
  for (const item of assigned) {
    const label = normalizeThreadTagLabel(item.label);
    if (!label) {
      continue;
    }
    const fromCatalog = catalogByKey.get(label.toLowerCase());
    if (!fromCatalog) {
      continue;
    }
    result.push(fromCatalog);
    if (result.length >= THREAD_TAG_MAX_COUNT) {
      break;
    }
  }
  return result;
}
