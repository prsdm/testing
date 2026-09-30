import {
  type CredentialSelect,
  getCredentialRowByIdForTenant,
  isPersonalConnectorProvider,
} from "@/core/lib/db/connector-queries";
import { decryptSecret } from "@/core/lib/security/crypto";

function parseToolConfigEncrypted(encrypted: string): Record<string, unknown> {
  try {
    const plain = decryptSecret(encrypted);
    const obj = JSON.parse(plain) as unknown;
    return typeof obj === "object" && obj !== null && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Server-only: merge credential secrets into tool config for execution. */
export function getResolvedToolInputParams(args: {
  configEncrypted: string;
  credentialId: string | null;
  credentialRow: CredentialSelect | null;
}): Record<string, unknown> {
  let config = parseToolConfigEncrypted(args.configEncrypted);
  if (args.credentialId && args.credentialRow?.enabled) {
    const secret = decryptSecret(args.credentialRow.secretEncrypted);
    if (args.credentialRow.type === "api_key") {
      config = { ...config, api_key: secret };
    } else if (args.credentialRow.type === "oauth2") {
      try {
        const parsed = JSON.parse(secret) as Record<string, unknown>;
        config = { ...config, ...parsed };
      } catch {
        config = { ...config, access_token: secret };
      }
    }
  }
  return config;
}

export async function getCredentialRowForResolve(
  credentialId: string | null,
  tenantId: string,
  userId: string,
  providerId?: string | null
): Promise<CredentialSelect | null> {
  if (!credentialId) {
    return null;
  }
  return await getCredentialRowByIdForTenant({
    id: credentialId,
    requireOwned: isPersonalConnectorProvider(providerId),
    tenantId,
    userId,
  });
}
