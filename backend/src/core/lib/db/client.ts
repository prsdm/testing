import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getPostgresUrl } from "./postgres-url";

declare global {
  // eslint-disable-next-line no-var
  var __kimiPostgresClient: ReturnType<typeof postgres> | undefined;
}

function createPostgresClient() {
  const url = getPostgresUrl();
  if (!url) {
    throw new Error("POSTGRES_URL is required");
  }
  return postgres(url, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 5,
  });
}

/** Shared Postgres client (singleton per process). */
export function getPostgresClient() {
  if (process.env.NODE_ENV === "production") {
    if (!globalThis.__kimiPostgresClient) {
      globalThis.__kimiPostgresClient = createPostgresClient();
    }
    return globalThis.__kimiPostgresClient;
  }

  if (!globalThis.__kimiPostgresClient) {
    globalThis.__kimiPostgresClient = createPostgresClient();
  }
  return globalThis.__kimiPostgresClient;
}

export function getDb() {
  return drizzle(getPostgresClient());
}
