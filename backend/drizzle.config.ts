import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { backendRoot } from "./src/migration/paths";

const injectedPostgresUrl = process.env.POSTGRES_URL;
config({ path: resolve(backendRoot, ".env") });
config({ override: true, path: resolve(backendRoot, ".env.local") });
if (injectedPostgresUrl !== undefined) {
  process.env.POSTGRES_URL = injectedPostgresUrl;
}

export default defineConfig({
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "",
  },
  dialect: "postgresql",
  out: resolve(backendRoot, "migrations"),
  schema: resolve(backendRoot, "src/core/lib/db/tables.ts"),
});
