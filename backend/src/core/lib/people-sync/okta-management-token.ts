import {
  createPrivateKey,
  createSign,
  type JsonWebKey,
  type KeyObject,
  randomUUID,
} from "node:crypto";
import {
  generateOktaDpopKeyPair,
  type OktaDpopKeyPair,
  signOktaDpopProof,
} from "@/core/lib/people-sync/okta-dpop";
import { ChatbotError } from "@/shared/errors";

const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

function tryExtractScopesFromOktaAccessTokenJwt(accessToken: string): string[] {
  const segments = accessToken.split(".");
  if (segments.length !== 3) {
    return [];
  }
  let payloadJson: string;
  try {
    payloadJson = Buffer.from(segments[1], "base64url").toString("utf8");
  } catch {
    return [];
  }
  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson) as unknown;
  } catch {
    return [];
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const rec = payload as Record<string, unknown>;
  const scopes: string[] = [];
  const scp = rec.scp;
  if (Array.isArray(scp)) {
    for (const item of scp) {
      if (typeof item === "string" && item.trim().length > 0) {
        scopes.push(item.trim());
      }
    }
  } else if (typeof scp === "string" && scp.trim().length > 0) {
    for (const part of scp.split(/\s+/)) {
      const t = part.trim();
      if (t.length > 0) {
        scopes.push(t);
      }
    }
  }
  const scopeField = rec.scope;
  if (typeof scopeField === "string" && scopeField.trim().length > 0) {
    for (const part of scopeField.split(/\s+/)) {
      const t = part.trim();
      if (t.length > 0) {
        scopes.push(t);
      }
    }
  }
  return scopes;
}

function collectGrantedOktaScopes(options: {
  tokenResponseScope?: string;
  accessToken: string;
}): string[] {
  const out = new Set<string>();
  if (typeof options.tokenResponseScope === "string") {
    for (const part of options.tokenResponseScope.split(/\s+/)) {
      const s = part.trim();
      if (s.length > 0) {
        out.add(s);
      }
    }
  }
  for (const s of tryExtractScopesFromOktaAccessTokenJwt(options.accessToken)) {
    out.add(s);
  }
  return [...out];
}

function base64UrlEncodeUtf8(text: string): string {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/[=]+$/, "");
}

function base64UrlEncodeBuffer(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/[=]+$/, "");
}

function tryParseOktaRsaJwk(trimmed: string): JsonWebKey | null {
  if (!trimmed.startsWith("{")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    throw new ChatbotError(
      "bad_request:api",
      "Private key looks like JSON but is not valid JSON. Fix commas/quotes or use PEM format."
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ChatbotError(
      "bad_request:api",
      "Private key JSON must be a single JWK object (not an array)."
    );
  }
  const jwk = parsed as Record<string, unknown>;
  if (jwk.kty !== "RSA") {
    throw new ChatbotError(
      "bad_request:api",
      'JWK must have kty "RSA" for Okta RS256 client assertions.'
    );
  }
  for (const field of ["n", "e", "d"] as const) {
    if (typeof jwk[field] !== "string" || jwk[field].length === 0) {
      throw new ChatbotError(
        "bad_request:api",
        `RSA JWK is missing required field "${field}". Paste the full private JWK from Okta (includes d, p, q, …).`
      );
    }
  }
  return parsed as JsonWebKey;
}

function loadRsaPrivateKeyForOkta(raw: string): {
  key: KeyObject;
  /** From JWK `kid` when the private key was pasted as JSON; included in the client assertion header when set. */
  jwkKid?: string;
} {
  const trimmed = raw.trim();

  let key: KeyObject;
  let jwkKid: string | undefined;

  const jwk = tryParseOktaRsaJwk(trimmed);
  if (jwk) {
    if (typeof jwk.kid === "string" && jwk.kid.length > 0) {
      jwkKid = jwk.kid;
    }
    try {
      key = createPrivateKey({ format: "jwk", key: jwk });
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : "Invalid JWK";
      throw new ChatbotError(
        "bad_request:api",
        `Could not load RSA key from JWK. Paste the private JWK JSON exactly as from Okta. Details: ${msg}`
      );
    }
  } else {
    if (!trimmed.includes("BEGIN") || !trimmed.includes("PRIVATE KEY")) {
      throw new ChatbotError(
        "bad_request:api",
        "Private key must be either (1) JSON JWK from Okta starting with {, or (2) PEM text with -----BEGIN ... PRIVATE KEY-----."
      );
    }
    if (
      trimmed.includes("ENCRYPTED") ||
      trimmed.includes("Proc-Type: 4,ENCRYPTED")
    ) {
      throw new ChatbotError(
        "bad_request:api",
        "This private key is password-protected (encrypted PEM). Export or generate an unencrypted PEM for the server, or use openssl to decrypt it locally and paste the result."
      );
    }

    try {
      key = createPrivateKey(trimmed);
    } catch (parseError) {
      const msg =
        parseError instanceof Error ? parseError.message : "Invalid PEM";
      throw new ChatbotError(
        "bad_request:api",
        `Could not read private key PEM. Check for full BEGIN/END lines, real newlines (not only spaces), and no extra characters. OpenSSL said: ${msg}`
      );
    }
  }

  const kind = key.asymmetricKeyType;
  if (kind !== "rsa") {
    throw new ChatbotError(
      "bad_request:api",
      kind === "ec"
        ? "This key is EC (elliptic curve). Okta client assertions here use RS256 and require an RSA private key. In your Okta API Services app, generate or upload an RSA key pair, not EC."
        : `Private key type "${kind ?? "unknown"}" is not supported. Use an RSA private key (JWK or PEM).`
    );
  }

  return { jwkKid, key };
}

function buildOktaClientAssertionJwt(options: {
  clientId: string;
  tokenUrl: string;
  privateKeyPem: string;
}): string {
  const { key: rsaKey, jwkKid } = loadRsaPrivateKeyForOkta(
    options.privateKeyPem
  );
  const kid = jwkKid;
  const now = Math.floor(Date.now() / 1000);
  const header: Record<string, string> = { alg: "RS256", typ: "JWT" };
  if (kid) {
    header.kid = kid;
  }
  const payload = {
    aud: options.tokenUrl,
    exp: now + 300,
    iat: now,
    iss: options.clientId,
    jti: randomUUID(),
    sub: options.clientId,
  };
  const headerPart = base64UrlEncodeUtf8(JSON.stringify(header));
  const payloadPart = base64UrlEncodeUtf8(JSON.stringify(payload));
  const sign = createSign("RSA-SHA256");
  sign.update(`${headerPart}.${payloadPart}`);
  sign.end();
  const signature = sign.sign(rsaKey);
  const signaturePart = base64UrlEncodeBuffer(signature);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

export type OktaManagementOAuthResult = {
  accessToken: string;
  /** From token response; use with Authorization scheme (often `DPoP` when DPoP is required). */
  tokenType: string;
  /** Same EC key pair must sign every DPoP proof until this access token is discarded. */
  dpop: OktaDpopKeyPair;
};

function parseUseDpopNonceError(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error === "use_dpop_nonce";
  } catch {
    return text.includes("use_dpop_nonce");
  }
}

/**
 * OAuth 2.0 client credentials for Okta Management APIs using a private-key JWT
 * (API Services integration). Sends a DPoP proof (RFC 9449) when required by the org.
 */
export async function fetchOktaManagementAccessToken(options: {
  baseUrl: string;
  clientId: string;
  privateKeyPem: string;
  scopes?: string[];
}): Promise<OktaManagementOAuthResult> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const tokenUrl = `${base}/oauth2/v1/token`;
  const scope =
    options.scopes && options.scopes.length > 0
      ? options.scopes.join(" ")
      : "okta.users.read okta.groups.read";

  const privateKeyPem = options.privateKeyPem.replaceAll("\\n", "\n");

  const dpop = generateOktaDpopKeyPair();

  const requestToken = (nonce?: string) => {
    let clientAssertion: string;
    try {
      // Build a fresh JWT for each attempt; Okta rejects replayed assertions.
      clientAssertion = buildOktaClientAssertionJwt({
        clientId: options.clientId,
        privateKeyPem,
        tokenUrl,
      });
    } catch (signError) {
      if (signError instanceof ChatbotError) {
        throw signError;
      }
      const msg =
        signError instanceof Error
          ? signError.message
          : "Unknown signing error";
      throw new ChatbotError(
        "bad_request:api",
        `Okta private key could not be used to sign the client assertion (RS256). Use an unencrypted RSA PEM. Details: ${msg}`
      );
    }

    const body = new URLSearchParams({
      client_assertion: clientAssertion,
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      grant_type: "client_credentials",
      scope,
    });

    return fetch(tokenUrl, {
      body,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        DPoP: signOktaDpopProof({
          dpopPrivateKey: dpop.privateKey,
          dpopPublicJwk: dpop.publicJwk,
          htm: "POST",
          htu: tokenUrl,
          nonce,
        }),
      },
      method: "POST",
    });
  };

  let response = await requestToken();

  if (!response.ok) {
    const nonce = response.headers.get("dpop-nonce");
    const text = await response.text();
    if (nonce && parseUseDpopNonceError(text)) {
      response = await requestToken(nonce);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ChatbotError(
      "bad_request:api",
      `Okta OAuth token request failed (${response.status}): ${text.slice(0, 400)}`
    );
  }

  const json = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
  };
  if (!json.access_token) {
    throw new ChatbotError(
      "bad_request:api",
      "Okta OAuth token response missing access_token"
    );
  }
  const grantedScopes = collectGrantedOktaScopes({
    accessToken: json.access_token,
    tokenResponseScope: json.scope,
  });
  if (grantedScopes.length > 0 && !grantedScopes.includes("okta.users.read")) {
    throw new ChatbotError(
      "bad_request:api",
      `Okta access token is missing "okta.users.read" (granted: ${grantedScopes.join(" ")}). In Okta Admin, open your API Services app → Okta API Scopes and grant okta.users.read. Assign an admin role to the app so it can list users. "okta.users.read.self" alone cannot populate the full directory.`
    );
  }
  const tokenType =
    typeof json.token_type === "string" && json.token_type.length > 0
      ? json.token_type
      : "Bearer";
  return {
    accessToken: json.access_token,
    dpop,
    tokenType,
  };
}
