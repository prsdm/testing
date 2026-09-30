import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_ALGO = "aes-256-gcm";

/**
 * Prefer SECRETS_ENCRYPTION_KEY so rotating auth secrets does not break
 * connector ciphertext. Fall back to BETTER_AUTH_SECRET for existing installs.
 */
function candidateEncryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  const seen = new Set<string>();

  const push = (material: string | undefined) => {
    const trimmed = material?.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    keys.push(createHash("sha256").update(trimmed).digest());
  };

  push(process.env.SECRETS_ENCRYPTION_KEY);
  push(process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET);

  if (keys.length === 0) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY (or BETTER_AUTH_SECRET / AUTH_SECRET) is required"
    );
  }

  return keys;
}

function decryptWithKey(cipherText: string, key: Buffer): string {
  const input = Buffer.from(cipherText, "base64url");
  const iv = input.subarray(0, 12);
  const tag = input.subarray(12, 28);
  const encrypted = input.subarray(28);
  const decipher = createDecipheriv(ENCRYPTION_ALGO, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12);
  const key = candidateEncryptionKeys().at(0);
  if (!key) {
    throw new Error("Encryption key is required");
  }
  const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(cipherText: string) {
  const keys = candidateEncryptionKeys();
  let lastError: unknown;
  for (const key of keys) {
    try {
      return decryptWithKey(cipherText, key);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to decrypt secret");
}
