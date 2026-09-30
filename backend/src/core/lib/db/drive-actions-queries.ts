import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantDriveActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantDriveActionsConfig = {
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  allowRead: boolean;
};

export async function ensureTenantDriveActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantDriveActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantDriveActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantDriveActionsSettings)
      .where(eq(tenantDriveActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant drive actions settings"
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
        : "Failed to ensure tenant drive actions settings"
    );
  }
}

export async function getTenantDriveActionsConfig(
  tenantId: string
): Promise<TenantDriveActionsConfig> {
  const row = await ensureTenantDriveActionsSettings(tenantId);
  return {
    allowRead: row.allowRead,
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
  };
}

export async function getTenantDriveActionsOAuthCredentials(tenantId: string) {
  const row = await ensureTenantDriveActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_GOOGLE_CLIENT_ID?.trim();
    const clientSecret =
      process.env.KIMIRO_MANAGED_GOOGLE_CLIENT_SECRET?.trim();
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

export async function updateTenantDriveActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    oauthClientId?: string;
    oauthClientSecret?: string;
    allowRead?: boolean;
  }
) {
  await ensureTenantDriveActionsSettings(tenantId);
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
      .update(tenantDriveActionsSettings)
      .set(patch)
      .where(eq(tenantDriveActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant drive actions settings"
    );
  }
}
