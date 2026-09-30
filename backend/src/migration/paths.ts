import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * The source module is in src/migration; the bundled module is in dist.
 * Both layouts resolve to this package without depending on process.cwd().
 */
export const backendRoot = moduleDirectory.endsWith("/dist")
  ? resolve(moduleDirectory, "..")
  : resolve(moduleDirectory, "../..");
export const migrationsFolder = resolve(backendRoot, "migrations");
