import { authInstance } from "@/core/lib/auth/server-session";
import { sessionPolicySensitiveMaxStaleSec } from "@/core/lib/auth/session-policy";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

export function getClientIpFromHeaders(headers: Headers): string | undefined {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = headers.get("x-real-ip")?.trim();
  return realIp && realIp.length > 0 ? realIp : undefined;
}

export async function requireSensitiveSession(
  request: Request,
  options: {
    resource: string;
    tenantId?: string;
    actionDenied?: string;
  }
): Promise<
  | {
      ok: true;
      user: { id: string; email?: string | null };
    }
  | { ok: false; response: Response }
> {
  const ip = getClientIpFromHeaders(request.headers);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const full = await authInstance.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });

  if (!full?.session || !full.user?.id) {
    await insertSecurityAuditEvent({
      action:
        options.actionDenied ?? "security.sensitive.denied_unauthenticated",
      email: undefined,
      ipAddress: ip,
      metadata: { reason: "no_session" },
      resource: options.resource,
      tenantId: options.tenantId,
      userAgent,
      userId: undefined,
    });
    return {
      ok: false,
      response: Response.json(
        { code: "UNAUTHORIZED", error: "Unauthorized" },
        {
          status: 401,
        }
      ),
    };
  }

  const updatedAtMs = new Date(full.session.updatedAt).getTime();
  const staleMs = Number.isFinite(updatedAtMs)
    ? Date.now() - updatedAtMs
    : Number.POSITIVE_INFINITY;
  const maxStaleMs = sessionPolicySensitiveMaxStaleSec * 1000;

  if (staleMs > maxStaleMs) {
    await insertSecurityAuditEvent({
      action: options.actionDenied ?? "security.sensitive.denied_stale_session",
      email: full.user.email ?? undefined,
      ipAddress: ip,
      metadata: {
        maxStaleMs,
        staleMs,
      },
      resource: options.resource,
      tenantId: options.tenantId,
      userAgent,
      userId: full.user.id,
    });
    return {
      ok: false,
      response: Response.json(
        {
          code: "REAUTH_REQUIRED",
          error: "Your session needs a refresh. Sign in again to continue.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user: { email: full.user.email, id: full.user.id } };
}
