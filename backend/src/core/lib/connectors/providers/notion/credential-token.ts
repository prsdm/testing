import {
  getCredentialRowByIdForTenant,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import { decryptSecret } from "@/core/lib/security/crypto";

type NotionSecretPayload = {
  access_token?: string;
  workspace_id?: string | null;
  workspace_name?: string | null;
  user_email?: string | null;
};

function parseNotionSecret(secretEncrypted: string): NotionSecretPayload {
  try {
    return JSON.parse(decryptSecret(secretEncrypted)) as NotionSecretPayload;
  } catch {
    return {};
  }
}

export async function ensureFreshNotionAccessToken(args: {
  credentialId: string;
  tenantId: string;
  userId: string;
}): Promise<{
  accessToken: string;
  workspaceId: string | null;
  workspaceName: string | null;
  userEmail: string | null;
}> {
  const credential = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!credential?.enabled) {
    throw new Error("Notion credential not found.");
  }
  const payload = parseNotionSecret(credential.secretEncrypted);
  if (!payload.access_token) {
    throw new Error("Notion access token missing.");
  }

  // Persist canonical JSON shape if old payload had odd values.
  await updateCredentialSecret({
    id: args.credentialId,
    plainSecret: JSON.stringify({
      access_token: payload.access_token,
      user_email: payload.user_email ?? null,
      workspace_id: payload.workspace_id ?? null,
      workspace_name: payload.workspace_name ?? null,
    }),
    tenantId: args.tenantId,
    userId: args.userId,
  }).catch(() => null);

  return {
    accessToken: payload.access_token,
    userEmail: payload.user_email ?? null,
    workspaceId: payload.workspace_id ?? null,
    workspaceName: payload.workspace_name ?? null,
  };
}
