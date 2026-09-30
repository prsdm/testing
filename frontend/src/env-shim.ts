import { Buffer as BufferPolyfill } from "buffer";

/**
 * Shared components read `process.env` for base path and flags. Vite does not
 * provide `process` in the browser — install a minimal env object first.
 */
const globalWithBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof BufferPolyfill;
};

if (typeof globalWithBuffer.Buffer === "undefined") {
  globalWithBuffer.Buffer = BufferPolyfill;
}

const nodeEnv =
  import.meta.env.MODE === "production" ? "production" : "development";

const browserEnv: Record<string, string | undefined> = {
  IS_DEMO: import.meta.env.VITE_IS_DEMO ?? "",
  KIMIRO_BASE_PATH: import.meta.env.VITE_KIMIRO_BASE_PATH ?? "",
  NODE_ENV: nodeEnv,
};

type ProcessShim = { env: Record<string, string | undefined> };

const processHolder = globalThis as unknown as { process?: ProcessShim };

if (
  typeof processHolder.process !== "object" ||
  processHolder.process === null
) {
  processHolder.process = { env: browserEnv };
} else {
  processHolder.process.env = {
    ...browserEnv,
    ...processHolder.process.env,
  };
}
