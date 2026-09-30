import { createHmac, timingSafeEqual } from "node:crypto";

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_STATE_COOKIE_MAX_AGE_SEC = 600;

function oauthStateSigningKey(): Buffer {
  const material =
    process.env.SECRETS_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!material) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY (or BETTER_AUTH_SECRET / AUTH_SECRET) is required to sign OAuth state"
    );
  }
  return Buffer.from(material, "utf8");
}

function isHttpsAppUrl() {
  const base = process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return base.startsWith("https://");
}

/** Shared cookie flags for OAuth state / PKCE cookies. */
export function oauthStateCookieOptions() {
  return {
    httpOnly: true as const,
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SEC,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" || isHttpsAppUrl(),
  };
}

type SignedEnvelope = {
  v: 1;
  iat: number;
  payload: unknown;
};

function signPayloadJson(payloadJson: string): string {
  return createHmac("sha256", oauthStateSigningKey())
    .update(payloadJson)
    .digest("base64url");
}

/**
 * Encode OAuth state as a signed cookie value.
 * Format: base64url(json).base64url(hmac)
 */
export function signOAuthStateCookie(payload: object): string {
  const envelope: SignedEnvelope = {
    iat: Date.now(),
    payload,
    v: 1,
  };
  const body = Buffer.from(JSON.stringify(envelope), "utf8").toString(
    "base64url"
  );
  const signature = signPayloadJson(body);
  return `${body}.${signature}`;
}

/**
 * Verify and decode a signed OAuth state cookie.
 * Rejects tampering, bad signatures, and expired envelopes.
 */
export function parseSignedOAuthStateCookie<T extends object>(
  raw: string | undefined | null
): T | null {
  if (!raw?.trim()) {
    return null;
  }

  const trimmed = raw.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) {
    return null;
  }

  const body = trimmed.slice(0, dot);
  const signature = trimmed.slice(dot + 1);
  const expected = signPayloadJson(body);

  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SignedEnvelope;
    if (decoded.v !== 1 || typeof decoded.iat !== "number") {
      return null;
    }
    if (Date.now() - decoded.iat > OAUTH_STATE_MAX_AGE_MS) {
      return null;
    }
    if (!decoded.payload || typeof decoded.payload !== "object") {
      return null;
    }
    return decoded.payload as T;
  } catch {
    return null;
  }
}
