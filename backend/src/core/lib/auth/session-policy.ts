function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return n;
}

function readNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}

/** Better Auth uses seconds for session lifetime / rolling refresh. */
export const sessionPolicyExpiresInSec = readPositiveInt(
  process.env.AUTH_SESSION_EXPIRES_SEC,
  8 * 60 * 60
);

/** How often idle-but-active sessions can roll forward (`updatedAt`). */
export const sessionPolicyUpdateAgeSec = readPositiveInt(
  process.env.AUTH_SESSION_UPDATE_AGE_SEC,
  15 * 60
);

/**
 * Passed through to Better Auth for built-in freshness checks (unused by our SSO routes directly).
 */
export const sessionPolicyFreshAgeSec = readPositiveInt(
  process.env.AUTH_SESSION_FRESH_AGE_SEC,
  8 * 60 * 60
);

/** Sensitive actions require recent session rolling refresh (`session.updatedAt`). */
export const sessionPolicySensitiveMaxStaleSec = readPositiveInt(
  process.env.AUTH_SENSITIVE_MAX_STALE_SEC,
  15 * 60
);

export function getSessionIdleTimeoutMs(): number {
  return readNonNegativeInt(process.env.AUTH_IDLE_TIMEOUT_MS, 30 * 60 * 1000);
}
