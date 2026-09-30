import {
  createHash,
  createPrivateKey,
  createSign,
  type KeyObject,
  randomUUID,
  X509Certificate,
} from "node:crypto";
import { ChatbotError } from "@/shared/errors";

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

function base64StandardEncodeBuffer(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * Parse a PEM bundle that includes a leaf certificate and an unencrypted
 * private key (typical export from Key Vault or OpenSSL).
 */
export function parseAzureDirectoryCertificatePem(raw: string): {
  privateKey: KeyObject;
  x5c: string[];
} {
  const trimmed = raw.replaceAll("\\n", "\n").trim();
  if (trimmed.includes("ENCRYPTED PRIVATE KEY")) {
    throw new ChatbotError(
      "bad_request:api",
      "Azure directory certificate PEM is encrypted. Export or paste an unencrypted private key block."
    );
  }

  const certMatch = trimmed.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
  );
  if (!certMatch) {
    throw new ChatbotError(
      "bad_request:api",
      "Azure directory PEM must include a -----BEGIN CERTIFICATE----- block (upload the public cert to Entra, paste cert + key here)."
    );
  }
  const keyMatch =
    trimmed.match(
      /-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/
    ) ??
    trimmed.match(
      /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/
    );
  if (!keyMatch) {
    throw new ChatbotError(
      "bad_request:api",
      "Azure directory PEM must include an unencrypted -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY----- block."
    );
  }

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(keyMatch[0]);
  } catch (parseError) {
    const msg =
      parseError instanceof Error ? parseError.message : "Invalid private key";
    throw new ChatbotError(
      "bad_request:api",
      `Could not load Azure directory private key PEM. ${msg}`
    );
  }

  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new ChatbotError(
      "bad_request:api",
      "Azure directory certificate flow requires an RSA private key. Use an RSA cert for the Entra app registration."
    );
  }

  let x509: X509Certificate;
  try {
    x509 = new X509Certificate(certMatch[0]);
  } catch (parseError) {
    const msg =
      parseError instanceof Error ? parseError.message : "Invalid certificate";
    throw new ChatbotError(
      "bad_request:api",
      `Could not parse Azure directory certificate PEM. ${msg}`
    );
  }

  const der = Buffer.from(x509.raw);
  const x5c = [der.toString("base64")];
  return { privateKey, x5c };
}

function buildEntraClientAssertionJwt(options: {
  tenantId: string;
  clientId: string;
  privateKey: KeyObject;
  x5t: string;
  x5c: string[];
}): string {
  const tokenUrl = `https://login.microsoftonline.com/${options.tenantId}/oauth2/v2.0/token`;
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    x5c: options.x5c,
    x5t: options.x5t,
  };
  const payload = {
    aud: tokenUrl,
    exp: now + 300,
    iat: now,
    iss: options.clientId,
    jti: randomUUID(),
    nbf: now - 120,
    sub: options.clientId,
  };
  const headerPart = base64UrlEncodeUtf8(JSON.stringify(header));
  const payloadPart = base64UrlEncodeUtf8(JSON.stringify(payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(options.privateKey);
  const signaturePart = base64UrlEncodeBuffer(signature);
  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

/**
 * OAuth 2.0 client credentials for Microsoft Graph using a certificate
 * registered on the Entra app (recommended over long-lived client secrets).
 */
export async function fetchAzureGraphAccessTokenWithCertificate(options: {
  tenantId: string;
  clientId: string;
  certificatePemBundle: string;
}): Promise<string> {
  const tenantId = options.tenantId.trim();
  const clientId = options.clientId.trim();
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const { privateKey, x5c } = parseAzureDirectoryCertificatePem(
    options.certificatePemBundle
  );
  const leafDer = Buffer.from(x5c[0], "base64");
  const sha1 = createHash("sha1").update(leafDer).digest();
  const x5t = base64StandardEncodeBuffer(sha1);

  const clientAssertion = buildEntraClientAssertionJwt({
    clientId,
    privateKey,
    tenantId,
    x5c,
    x5t,
  });

  const body = new URLSearchParams({
    client_assertion: clientAssertion,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_id: clientId,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ChatbotError(
      "bad_request:api",
      `Microsoft token request failed (${response.status}): ${text.slice(0, 400)}`
    );
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new ChatbotError(
      "bad_request:api",
      "Microsoft token response missing access_token"
    );
  }
  return json.access_token;
}
