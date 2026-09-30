/** Slack-style default avatar backgrounds (stable per user until they upload a photo). */
const USER_AVATAR_FALLBACK_COLORS = [
  "#914669",
  "#737BC7",
  "#2BAC76",
  "#E8912D",
  "#D55EEF",
  "#4A90A4",
  "#E06B56",
  "#6B5794",
  "#3D85C6",
  "#C15B8A",
  "#5E966E",
  "#8B6914",
] as const;

function hashStringToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % modulo;
}

export function getUserAvatarFallbackColor(seed: string): string {
  const normalized = seed.trim().toLowerCase();
  if (!normalized) {
    return USER_AVATAR_FALLBACK_COLORS[0];
  }
  return USER_AVATAR_FALLBACK_COLORS[
    hashStringToIndex(normalized, USER_AVATAR_FALLBACK_COLORS.length)
  ];
}

export function userAvatarColorSeed(args: {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  const userId = args.userId?.trim();
  if (userId) {
    return `id:${userId}`;
  }
  return args.email?.trim() || args.name?.trim() || "user";
}
