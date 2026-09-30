export const DEFAULT_GROUP_ICON = "users-round";

export const FEATURED_GROUP_ICONS = [
  "users-round",
  "users",
  "user-round",
  "building-2",
  "briefcase",
  "code",
  "code-2",
  "shield",
  "shield-check",
  "heart",
  "star",
  "folder",
  "folder-open",
  "globe",
  "lock",
  "key",
  "settings",
  "wrench",
  "hammer",
  "rocket",
  "zap",
  "target",
  "flag",
  "book-open",
  "graduation-cap",
  "headphones",
  "life-buoy",
  "mail",
  "message-square",
  "phone",
  "video",
  "calendar",
  "clock",
  "map-pin",
  "truck",
  "shopping-cart",
  "credit-card",
  "database",
  "server",
  "cloud",
  "cpu",
  "bot",
  "sparkles",
] as const;

const allowedGroupIcons = new Set<string>(FEATURED_GROUP_ICONS);

export const GROUP_ICON_NAMES = [...FEATURED_GROUP_ICONS];

export function normalizeGroupIcon(icon: string | null | undefined) {
  const trimmed = icon?.trim();
  if (trimmed && isValidGroupIcon(trimmed)) {
    return trimmed;
  }
  return DEFAULT_GROUP_ICON;
}

export function isValidGroupIcon(icon: string) {
  return allowedGroupIcons.has(icon);
}

export function searchGroupIcons(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...FEATURED_GROUP_ICONS];
  }

  return GROUP_ICON_NAMES.filter((iconName) =>
    iconName.includes(normalizedQuery)
  ).slice(0, 120);
}
