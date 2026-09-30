import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantSharePointActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantSharePointActionsConfig = {
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  allowRead: boolean;
};

export async function ensureTenantSharePointActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantSharePointActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantSharePointActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantSharePointActionsSettings)
      .where(eq(tenantSharePointActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant SharePoint settings"
      );
    }
    return existing;
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to ensure tenant SharePoint settings"
    );
  }
}

export async function getTenantSharePointActionsConfig(
  tenantId: string
): Promise<TenantSharePointActionsConfig> {
  const row = await ensureTenantSharePointActionsSettings(tenantId);
  return {
    allowRead: row.allowRead,
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
  };
}

export async function getTenantSharePointActionsOAuthCredentials(
  tenantId: string
) {
  const row = await ensureTenantSharePointActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_SHAREPOINT_CLIENT_ID?.trim();
    const clientSecret =
      process.env.KIMIRO_MANAGED_SHAREPOINT_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }
    return {
      clientId,
      clientSecret,
      credentialMode: mode,
      settings: row,
    };
  }

  if (!row.oauthClientId || !row.oauthClientSecretEncrypted) {
    return null;
  }
  return {
    clientId: row.oauthClientId,
    clientSecret: decryptSecret(row.oauthClientSecretEncrypted),
    credentialMode: mode,
    settings: row,
  };
}

export async function updateTenantSharePointActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    oauthClientId?: string;
    oauthClientSecret?: string;
    allowRead?: boolean;
  }
) {
  await ensureTenantSharePointActionsSettings(tenantId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.credentialMode !== undefined) {
    patch.credentialMode = input.credentialMode;
  }
  if (input.oauthClientId !== undefined) {
    patch.oauthClientId = input.oauthClientId.trim() || null;
  }
  if (input.oauthClientSecret?.trim()) {
    patch.oauthClientSecretEncrypted = encryptSecret(
      input.oauthClientSecret.trim()
    );
  }
  if (input.allowRead !== undefined) {
    patch.allowRead = input.allowRead;
  }

  try {
    const [updated] = await db
      .update(tenantSharePointActionsSettings)
      .set(patch)
      .where(eq(tenantSharePointActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant SharePoint settings"
    );
  }
}
