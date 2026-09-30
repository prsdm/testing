/** Prefer display name from `Name <email@x.com>`, else the raw From value. */
export function gmailFromDisplayName(from?: string) {
  const value = from?.trim();
  if (!value) {
    return;
  }
  const named = value.match(/^"?([^"<]+?)"?\s*<[^>]+>$/);
  if (named?.[1]?.trim()) {
    return named[1].trim();
  }
  return value;
}
