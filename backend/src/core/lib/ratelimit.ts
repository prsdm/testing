import { isProductionEnvironment } from "@/core/lib/constants";
import { getRedisClient } from "@/core/lib/redis/client";
import { ChatbotError } from "@/shared/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60;
const MAX_SETUP_ATTEMPTS = 20;

type LocalWindow = { n: number; resetAt: number };
const localHits = new Map<string, LocalWindow>();

function checkLocalRateLimit(key: string, max: number, ttlSeconds: number) {
  const now = Date.now();
  const cur = localHits.get(key);
  if (!cur || cur.resetAt <= now) {
    localHits.set(key, { n: 1, resetAt: now + ttlSeconds * 1000 });
    return;
  }
  cur.n += 1;
  if (cur.n > max) {
    throw new ChatbotError("rate_limit:chat");
  }
}

async function checkRedisOrLocal(args: {
  redisKey: string;
  localKey: string;
  max: number;
  ttlSeconds: number;
}) {
  const redis = getRedisClient();
  if (redis?.isReady) {
    try {
      const [count] = await redis
        .multi()
        .incr(args.redisKey)
        .expire(args.redisKey, args.ttlSeconds, "NX")
        .exec();

      if (typeof count === "number" && count > args.max) {
        throw new ChatbotError("rate_limit:chat");
      }
      return;
    } catch (error) {
      if (error instanceof ChatbotError) {
        throw error;
      }
      // Fall through to local limiter when Redis errors.
    }
  }

  checkLocalRateLimit(args.localKey, args.max, args.ttlSeconds);
}

/** Chat IP limiter — Redis when available, otherwise process-local (prod). */
export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  await checkRedisOrLocal({
    localKey: `chat:${ip}`,
    max: MAX_MESSAGES,
    redisKey: `ip-rate-limit:${ip}`,
    ttlSeconds: TTL_SECONDS,
  });
}

/** Setup wizard — always enforce when an IP is present (token guessing). */
export async function checkSetupIpRateLimit(ip: string | undefined) {
  const key = ip?.trim() || "unknown";
  await checkRedisOrLocal({
    localKey: `setup:${key}`,
    max: MAX_SETUP_ATTEMPTS,
    redisKey: `setup-rate-limit:${key}`,
    ttlSeconds: TTL_SECONDS,
  });
}
