export const WEB_SEARCH_AUTO_READ_LIMITS = [3, 5, 10] as const;

export type WebSearchAutoReadLimit =
  (typeof WEB_SEARCH_AUTO_READ_LIMITS)[number];

export const DEFAULT_WEB_SEARCH_AUTO_READ_LIMIT: WebSearchAutoReadLimit = 5;

export function isWebSearchAutoReadLimit(
  value: number
): value is WebSearchAutoReadLimit {
  return (WEB_SEARCH_AUTO_READ_LIMITS as readonly number[]).includes(value);
}
