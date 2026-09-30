export function parseSharePointCompositePageRef(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes("::")) {
    return null;
  }
  const [siteId, pageId] = trimmed.split("::");
  if (!siteId?.trim() || !pageId?.trim()) {
    return null;
  }
  return { pageId: pageId.trim(), siteId: siteId.trim() };
}
