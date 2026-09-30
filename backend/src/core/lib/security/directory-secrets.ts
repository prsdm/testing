import type { ProviderDirectoryCredentials } from "@/core/lib/people-sync/types";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";

const DIRECTORY_SECRET_KEYS = [
  "oktaPrivateKey",
  "azureClientCertificatePem",
  "serviceAccountPrivateKey",
] as const;

type DirectorySecretKey = (typeof DIRECTORY_SECRET_KEYS)[number];

const ENC_PREFIX = "enc:v1:";

function isEncryptedSecret(value: string) {
  return value.startsWith(ENC_PREFIX);
}

function encryptDirectorySecret(plainText: string) {
  const trimmed = plainText.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (isEncryptedSecret(trimmed)) {
    return trimmed;
  }
  return `${ENC_PREFIX}${encryptSecret(trimmed)}`;
}

function decryptDirectorySecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (!isEncryptedSecret(trimmed)) {
    // Legacy plaintext — still usable until next save re-encrypts.
    return trimmed;
  }
  return decryptSecret(trimmed.slice(ENC_PREFIX.length));
}

/** Encrypt known private-key fields before persisting SSO directory metadata. */
export function encryptDirectoryCredentialsForStorage(
  directory: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...directory };
  for (const key of DIRECTORY_SECRET_KEYS) {
    const value = next[key];
    if (typeof value === "string" && value.trim()) {
      next[key] = encryptDirectorySecret(value);
    }
  }
  return next;
}

/** Decrypt directory credentials for runtime use (IdP pull, Drive membership). */
export function decryptDirectoryCredentials(
  directory:
    | ProviderDirectoryCredentials
    | Record<string, unknown>
    | null
    | undefined
): ProviderDirectoryCredentials {
  if (!directory || typeof directory !== "object") {
    return {};
  }
  const next: Record<string, unknown> = { ...directory };
  for (const key of DIRECTORY_SECRET_KEYS) {
    const value = next[key];
    if (typeof value === "string" && value.trim()) {
      try {
        next[key] = decryptDirectorySecret(value);
      } catch {
        // Leave as-is if decrypt fails (wrong key / corrupt).
      }
    }
  }
  return next as ProviderDirectoryCredentials;
}

export function isDirectorySecretKey(key: string): key is DirectorySecretKey {
  return (DIRECTORY_SECRET_KEYS as readonly string[]).includes(key);
}
