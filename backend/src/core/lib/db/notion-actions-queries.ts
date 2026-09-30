import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantNotionActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantNotionActionsConfig = {
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  allowRead: boolean;
};

export async function ensureTenantNotionActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantNotionActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantNotionActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantNotionActionsSettings)
      .where(eq(tenantNotionActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant Notion actions settings"
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
        : "Failed to ensure tenant Notion actions settings"
    );
  }
}

export async function getTenantNotionActionsConfig(
  tenantId: string
): Promise<TenantNotionActionsConfig> {
  const row = await ensureTenantNotionActionsSettings(tenantId);
  return {
    allowRead: row.allowRead,
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
  };
}

export async function getTenantNotionActionsOAuthCredentials(tenantId: string) {
  const row = await ensureTenantNotionActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_NOTION_CLIENT_ID?.trim();
    const clientSecret =
      process.env.KIMIRO_MANAGED_NOTION_CLIENT_SECRET?.trim();
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

export async function updateTenantNotionActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    oauthClientId?: string;
    oauthClientSecret?: string;
    allowRead?: boolean;
  }
) {
  await ensureTenantNotionActionsSettings(tenantId);
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
      .update(tenantNotionActionsSettings)
      .set(patch)
      .where(eq(tenantNotionActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant Notion actions settings"
    );
  }
}
