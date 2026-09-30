import {
  createHash,
  generateKeyPairSync,
  type JsonWebKey,
  type KeyObject,
  randomUUID,
  sign,
} from "node:crypto";

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

export type OktaDpopKeyPair = {
  privateKey: KeyObject;
  /** Public JWK embedded in each DPoP proof (EC P-256 / ES256). */
  publicJwk: JsonWebKey;
};

/**
 * Ephemeral EC P-256 key pair for Okta DPoP (RFC 9449). Reuse the same pair
 * for token exchange and subsequent Management API calls until the access token expires.
 */
export function generateOktaDpopKeyPair(): OktaDpopKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const exported = publicKey.export({ format: "jwk" }) as JsonWebKey;
  if (
    exported.kty !== "EC" ||
    exported.crv !== "P-256" ||
    typeof exported.x !== "string" ||
    typeof exported.y !== "string"
  ) {
    throw new Error("Unexpected EC JWK export for DPoP");
  }
  const publicJwk: JsonWebKey = {
    crv: exported.crv,
    kty: exported.kty,
    x: exported.x,
    y: exported.y,
  };
  return { privateKey, publicJwk };
}

export function signOktaDpopProof(options: {
  dpopPrivateKey: KeyObject;
  dpopPublicJwk: JsonWebKey;
  htm: "GET" | "POST";
  /** Exact HTTP URI for the request (no fragment), per RFC 9449. */
  htu: string;
  /** Optional nonce required by some authorization/resource servers. */
  nonce?: string;
  /**
   * Optional access token used for `ath` on resource requests.
   * Per RFC 9449, `ath` is base64url(SHA-256(access_token)).
   */
  accessToken?: string;
}): string {
  const header = {
    alg: "ES256",
    jwk: options.dpopPublicJwk,
    typ: "dpop+jwt",
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    htm: options.htm,
    htu: options.htu,
    iat: now,
    jti: randomUUID(),
    ...(options.nonce ? { nonce: options.nonce } : {}),
    ...(options.accessToken
      ? {
          ath: base64UrlEncodeBuffer(
            createHash("sha256").update(options.accessToken, "utf8").digest()
          ),
        }
      : {}),
  };
  const headerPart = base64UrlEncodeUtf8(JSON.stringify(header));
  const payloadPart = base64UrlEncodeUtf8(JSON.stringify(payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const signature = sign("sha256", Buffer.from(signingInput, "utf8"), {
    dsaEncoding: "ieee-p1363",
    key: options.dpopPrivateKey,
  });
  const signaturePart = base64UrlEncodeBuffer(signature);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}
