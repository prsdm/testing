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

/** Notion color menu order + labels. */
export const THREAD_TAG_COLOR_OPTIONS: {
  id: ThreadTagColorId;
  label: string;
}[] = [
  { id: "default", label: "Default" },
  { id: "gray", label: "Gray" },
  { id: "brown", label: "Brown" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
  { id: "red", label: "Red" },
];

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

/** Notion-style tag colors (light UI). */
export const THREAD_TAG_COLOR_STYLES: Record<
  ThreadTagColorId,
  { dot: string; pill: string; swatchBox: string }
> = {
  blue: {
    dot: "bg-sky-600",
    pill: "bg-sky-500/15 text-sky-900 dark:text-sky-200",
    swatchBox:
      "border-sky-300/80 bg-sky-200/90 dark:border-sky-600/50 dark:bg-sky-900/80",
  },
  brown: {
    dot: "bg-amber-900/80",
    pill: "bg-amber-900/10 text-amber-950 dark:text-amber-200",
    swatchBox:
      "border-amber-900/30 bg-amber-950/15 dark:border-amber-700/50 dark:bg-amber-950/80",
  },
  default: {
    dot: "bg-neutral-500",
    pill: "bg-neutral-500/10 text-neutral-800 dark:text-neutral-200",
    swatchBox:
      "border-neutral-300/90 bg-neutral-100 dark:border-neutral-600/60 dark:bg-neutral-800/90",
  },
  gray: {
    dot: "bg-neutral-500",
    pill: "bg-neutral-500/12 text-neutral-800 dark:text-neutral-200",
    swatchBox:
      "border-neutral-400/70 bg-neutral-200/90 dark:border-neutral-500/50 dark:bg-neutral-700/90",
  },
  green: {
    dot: "bg-emerald-600",
    pill: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
    swatchBox:
      "border-emerald-300/80 bg-emerald-200/80 dark:border-emerald-700/50 dark:bg-emerald-950/80",
  },
  orange: {
    dot: "bg-orange-600",
    pill: "bg-orange-500/15 text-orange-950 dark:text-orange-200",
    swatchBox:
      "border-orange-300/80 bg-orange-200/80 dark:border-orange-700/50 dark:bg-orange-950/80",
  },
  pink: {
    dot: "bg-pink-600",
    pill: "bg-pink-500/15 text-pink-950 dark:text-pink-200",
    swatchBox:
      "border-pink-300/80 bg-pink-200/80 dark:border-pink-700/50 dark:bg-pink-950/80",
  },
  purple: {
    dot: "bg-violet-600",
    pill: "bg-violet-500/15 text-violet-950 dark:text-violet-200",
    swatchBox:
      "border-violet-300/80 bg-violet-200/80 dark:border-violet-700/50 dark:bg-violet-950/80",
  },
  red: {
    dot: "bg-red-600",
    pill: "bg-red-500/15 text-red-950 dark:text-red-200",
    swatchBox:
      "border-red-300/80 bg-red-200/80 dark:border-red-700/50 dark:bg-red-950/80",
  },
  yellow: {
    dot: "bg-yellow-600",
    pill: "bg-yellow-400/25 text-yellow-950 dark:text-yellow-200",
    swatchBox:
      "border-yellow-300/80 bg-yellow-200/80 dark:border-yellow-700/50 dark:bg-yellow-950/80",
  },
};

/** Tolaria-style list row selection (left bar + tinted background). */
const THREAD_TAG_LIST_SELECTION: Record<
  ThreadTagColorId,
  { border: string; background: string }
> = {
  blue: {
    border: "#0284c7",
    background: "color-mix(in srgb, #0284c7 10%, transparent)",
  },
  brown: {
    border: "#92400e",
    background: "color-mix(in srgb, #92400e 10%, transparent)",
  },
  default: {
    border: "#525252",
    background: "color-mix(in srgb, #525252 8%, transparent)",
  },
  gray: {
    border: "#525252",
    background: "color-mix(in srgb, #525252 8%, transparent)",
  },
  green: {
    border: "#059669",
    background: "color-mix(in srgb, #059669 10%, transparent)",
  },
  orange: {
    border: "#ea580c",
    background: "color-mix(in srgb, #ea580c 10%, transparent)",
  },
  pink: {
    border: "#db2777",
    background: "color-mix(in srgb, #db2777 10%, transparent)",
  },
  purple: {
    border: "#7c3aed",
    background: "color-mix(in srgb, #7c3aed 10%, transparent)",
  },
  red: {
    border: "#dc2626",
    background: "color-mix(in srgb, #dc2626 10%, transparent)",
  },
  yellow: {
    border: "#ca8a04",
    background: "color-mix(in srgb, #ca8a04 12%, transparent)",
  },
};

const CHANNEL_LIST_SELECTION_DEFAULT = {
  border: "#6264A7",
  background: "color-mix(in srgb, #6264A7 9%, transparent)",
} as const;

export function threadTagListSelectionStyle(
  colorId: ThreadTagColorId | null | undefined
): { border: string; background: string } {
  if (!colorId) {
    return CHANNEL_LIST_SELECTION_DEFAULT;
  }
  return (
    THREAD_TAG_LIST_SELECTION[colorId] ?? THREAD_TAG_LIST_SELECTION.default
  );
}

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

export function parseThreadTagColor(raw: unknown): ThreadTagColorId | null {
  const parsed = threadTagColorIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Accepts legacy `string[]` or `{ label, color }[]` without applying count limits. */
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

/** Accepts legacy `string[]` or `{ label, color }[]` from metadata (`threadTags`). */
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

/** Keep only labels present in the channel catalog (preserves catalog colors). */
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

export function threadTagColorStyle(topic: Pick<ThreadTag, "color" | "label">) {
  const resolved =
    parseThreadTagColor(topic.color) ?? defaultColorForLabel(topic.label);
  return THREAD_TAG_COLOR_STYLES[resolved];
}
