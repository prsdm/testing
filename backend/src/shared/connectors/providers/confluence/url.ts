export function normalizeAtlassianSourceLink(link: string) {
  const normalizedInput = /^[a-z0-9.-]+\.atlassian\.net\//i.test(link)
    ? `https://${link}`
    : link;

  try {
    const url = new URL(normalizedInput);
    if (url.hostname.endsWith(".atlassian.net")) {
      if (url.pathname.startsWith("/spaces/")) {
        url.pathname = `/wiki${url.pathname}`;
      }
      if (url.pathname.startsWith("/wiki/wiki/")) {
        url.pathname = url.pathname.replace(/^\/wiki\/wiki\//, "/wiki/");
      }
      const legacyMatch = url.pathname.match(/^\/wiki\/spaces\/~(\d+)$/);
      if (legacyMatch) {
        url.pathname = `/wiki/pages/${legacyMatch[1]}`;
      }
    }
    return url.toString();
  } catch {
    return normalizedInput;
  }
}
