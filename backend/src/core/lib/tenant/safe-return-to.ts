const APP_PATH_PREFIXES = [
  "/c",
  "/connectors",
  "/sources",
  "/knowledge",
  "/admin",
] as const;

/**
 * Restrict post-OAuth redirects to same-origin app paths.
 * Rejects protocol-relative URLs (`//evil.com`) and other open-redirect forms.
 */
export function safeAppReturnTo(
  returnTo: string | null | undefined,
  _tenantSlug: string,
  fallback = "/connectors"
): string {
  if (!returnTo) {
    return fallback;
  }

  // Must be a relative path; reject protocol-relative and absolute URLs.
  if (
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.includes("\\") ||
    returnTo.includes("://")
  ) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(returnTo);
  } catch {
    return fallback;
  }

  if (
    decoded.includes("..") ||
    decoded.startsWith("//") ||
    decoded.includes("://") ||
    decoded.includes("\\")
  ) {
    return fallback;
  }

  const pathOnly = returnTo.split(/[?#]/, 2)[0] ?? returnTo;

  if (pathOnly === "/") {
    return returnTo;
  }

  for (const prefix of APP_PATH_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) {
      return returnTo;
    }
  }

  return fallback;
}
