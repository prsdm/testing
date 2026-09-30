/** GCS prefix root for sandbox session workspaces (same bucket as Library). */
export const SANDBOX_GCS_PREFIX = "sandbox";

/** Local dev / Cloud Run mount for session folders. */
export const SANDBOX_SESSIONS_ROOT =
  process.env.SANDBOX_SESSIONS_ROOT ?? "/workspace/sessions";
