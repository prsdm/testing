import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { authSession } from "@/core/lib/db/tables";
import { getRedisClient } from "@/core/lib/redis/client";

const AUTH_SESSION_REDIS_PREFIX = "kimi:auth-session:";
const AUTH_SESSION_USER_REDIS_PREFIX = "kimi:auth-session-user:";

/**
 * Drop Redis session snapshots + Better Auth DB sessions for a user.
 * Safe to call from membership/IdP deactivate paths (no auth.ts import).
 */
export async function invalidateAuthSessionsForUser(
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  if (redis?.isReady) {
    try {
      const userKey = `${AUTH_SESSION_USER_REDIS_PREFIX}${userId}`;
      const cacheKeys = await redis.sMembers(userKey);
      const keysToDelete = [
        ...cacheKeys.map((key) => `${AUTH_SESSION_REDIS_PREFIX}${key}`),
        userKey,
      ];
      if (keysToDelete.length > 0) {
        await redis.del(keysToDelete);
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const db = getDb();
    await db.delete(authSession).where(eq(authSession.userId, userId));
  } catch {
    /* ignore */
  }
}
