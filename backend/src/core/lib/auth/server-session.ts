import { createHash } from "node:crypto";
import { authInstance } from "@/core/lib/auth/better-auth-instance";
import { requestHeaders } from "@/core/lib/http/request-context";
import { getRedisClient } from "@/core/lib/redis/client";
import type { AppSession } from "@/shared/auth/types";

export { invalidateAuthSessionsForUser } from "@/core/lib/auth/invalidate-sessions";

export type UserType = "regular";

type AuthSessionCacheEnvelope =
  | { v: 1; kind: "none" }
  | { v: 1; kind: "session"; user: AppSession["user"] };

const AUTH_SESSION_REDIS_PREFIX = "kimi:auth-session:";
const AUTH_SESSION_USER_REDIS_PREFIX = "kimi:auth-session-user:";
/** TTL for Redis snapshot of Better Auth session (cookie-keyed). */
const AUTH_SESSION_CACHE_TTL_MS = 15_000;

const sessionLookupInflightByCacheKey = new Map<
  string,
  Promise<AppSession | null>
>();

export { authInstance } from "@/core/lib/auth/better-auth-instance";

function getSessionCacheKey(requestHeaders: Headers) {
  const cookieHeader = requestHeaders.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  return createHash("sha256").update(cookieHeader).digest("hex");
}

async function readAuthSessionFromRedis(
  cacheKey: string
): Promise<{ hit: false } | { hit: true; session: AppSession | null }> {
  const redis = getRedisClient();
  if (!redis?.isReady) {
    return { hit: false };
  }

  try {
    const raw = await redis.get(`${AUTH_SESSION_REDIS_PREFIX}${cacheKey}`);
    if (raw === null) {
      return { hit: false };
    }

    const parsed = JSON.parse(raw) as AuthSessionCacheEnvelope;
    if (parsed.v !== 1) {
      return { hit: false };
    }

    if (parsed.kind === "none") {
      return { hit: true, session: null };
    }

    return { hit: true, session: { user: parsed.user } };
  } catch {
    return { hit: false };
  }
}

async function writeAuthSessionToRedis(
  cacheKey: string,
  session: AppSession | null
): Promise<void> {
  const redis = getRedisClient();
  if (!redis?.isReady) {
    return;
  }

  const ttlSec =
    session === null
      ? Math.max(1, Math.ceil(Math.min(AUTH_SESSION_CACHE_TTL_MS, 5000) / 1000))
      : Math.max(1, Math.ceil(AUTH_SESSION_CACHE_TTL_MS / 1000));

  try {
    const envelope: AuthSessionCacheEnvelope =
      session === null
        ? { kind: "none", v: 1 }
        : { kind: "session", user: session.user, v: 1 };

    await redis.set(
      `${AUTH_SESSION_REDIS_PREFIX}${cacheKey}`,
      JSON.stringify(envelope),
      {
        EX: ttlSec,
      }
    );

    if (session?.user?.id) {
      const userKey = `${AUTH_SESSION_USER_REDIS_PREFIX}${session.user.id}`;
      await redis.sAdd(userKey, cacheKey);
      await redis.expire(userKey, Math.max(ttlSec * 4, 60));
    }
  } catch {
    /* non-critical cache write */
  }
}

async function invalidateAuthSessionRedis(cacheKey: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    await redis.del(`${AUTH_SESSION_REDIS_PREFIX}${cacheKey}`);
  } catch {
    /* ignore */
  }
}

export async function invalidateAuthSessionCache(
  requestHeaders: Headers
): Promise<void> {
  const cacheKey = getSessionCacheKey(requestHeaders);
  if (!cacheKey) {
    return;
  }

  await invalidateAuthSessionRedis(cacheKey);
}

async function loadSessionFromAuth(
  requestHeaders: Headers,
  cacheKey: string | null
): Promise<AppSession | null> {
  const session = await authInstance.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    if (cacheKey) {
      await writeAuthSessionToRedis(cacheKey, null);
    }
    return null;
  }

  const appSession: AppSession = {
    user: {
      email: session.user.email,
      id: session.user.id,
      image: session.user.image,
      name: session.user.name,
      type: "regular" as const,
    },
  };

  if (cacheKey) {
    await writeAuthSessionToRedis(cacheKey, appSession);
  }

  return appSession;
}

export async function auth(): Promise<AppSession | null> {
  const headers = requestHeaders();
  const cacheKey = getSessionCacheKey(headers);

  if (cacheKey) {
    const redisRead = await readAuthSessionFromRedis(cacheKey);
    if (redisRead.hit) {
      return redisRead.session;
    }
  }

  if (!cacheKey) {
    return loadSessionFromAuth(headers, null);
  }

  const existingInflight = sessionLookupInflightByCacheKey.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const lookupPromise = loadSessionFromAuth(headers, cacheKey).finally(() => {
    sessionLookupInflightByCacheKey.delete(cacheKey);
  });
  sessionLookupInflightByCacheKey.set(cacheKey, lookupPromise);
  return lookupPromise;
}
