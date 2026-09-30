import { createClient } from "redis";

let client: ReturnType<typeof createClient> | null = null;

export function getRedisClient(): ReturnType<typeof createClient> | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (!client) {
    const nextClient = createClient({ url });
    client = nextClient;
    nextClient.on("error", () => undefined);
    nextClient.connect().catch(() => {
      client = null;
    });
  }

  return client;
}
