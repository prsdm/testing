export const ACTIVE_TENANT_COOKIE = "kimi-active-tenant";

export const ACTIVE_TENANT_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Read preferred workspace slug from a Cookie header value. */
export function preferredTenantSlugFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === ACTIVE_TENANT_COOKIE) {
      const value = rest.join("=").trim();
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}
