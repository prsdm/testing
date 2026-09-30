import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { authSsoProvider } from "@/core/lib/db/tables";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";

const ENC_PREFIX = "enc:v1:";

export type OidcConfigFields = {
  issuer?: string;
  clientId: string;
  clientSecret: string;
  pkce?: boolean;
  discoveryEndpoint?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksEndpoint?: string;
  userInfoEndpoint?: string;
  scopes?: string[];
};

function isSealedSecret(value: string) {
  return value.startsWith(ENC_PREFIX);
}

/** Persist OIDC config with clientSecret encrypted at rest. */
export function sealOidcConfigJson(config: OidcConfigFields): string {
  const clientSecret = config.clientSecret.trim();
  const sealedSecret = isSealedSecret(clientSecret)
    ? clientSecret
    : `${ENC_PREFIX}${encryptSecret(clientSecret)}`;

  return JSON.stringify({
    ...config,
    clientSecret: sealedSecret,
  });
}

/** Decrypt clientSecret for Better Auth (expects plaintext). */
export function unsealOidcConfigJson(raw: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }

  const secret = parsed.clientSecret;
  if (typeof secret !== "string" || !secret.trim()) {
    return raw;
  }
  if (!isSealedSecret(secret)) {
    return raw;
  }

  return JSON.stringify({
    ...parsed,
    clientSecret: decryptSecret(secret.slice(ENC_PREFIX.length)),
  });
}

function oidcConfigNeedsSeal(raw: string | null): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { clientSecret?: string };
    return (
      typeof parsed.clientSecret === "string" &&
      parsed.clientSecret.trim().length > 0 &&
      !isSealedSecret(parsed.clientSecret)
    );
  } catch {
    return false;
  }
}

/**
 * One-shot repair: re-encrypt any plaintext clientSecret left in
 * ssoProvider.oidcConfig. Prefer the in-memory adapter wrapper for SSO reads;
 * do not unseal into the DB on the request path.
 */
export async function sealAuthSsoOidcSecretsInDb() {
  const db = getDb();
  const rows = await db
    .select({
      id: authSsoProvider.id,
      oidcConfig: authSsoProvider.oidcConfig,
    })
    .from(authSsoProvider);

  for (const row of rows) {
    if (!oidcConfigNeedsSeal(row.oidcConfig)) {
      continue;
    }
    let parsed: OidcConfigFields;
    try {
      parsed = JSON.parse(row.oidcConfig as string) as OidcConfigFields;
    } catch {
      continue;
    }
    if (!parsed.clientId || !parsed.clientSecret) {
      continue;
    }
    await db
      .update(authSsoProvider)
      .set({
        oidcConfig: sealOidcConfigJson(parsed),
        updatedAt: new Date(),
      })
      .where(eq(authSsoProvider.id, row.id));
  }
}

export function isSsoAuthRequest(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return (
      path.includes("/sso/") ||
      path.includes("/callback/") ||
      path.includes("sign-in/sso") ||
      path.includes("/oauth2/")
    );
  } catch {
    return false;
  }
}
