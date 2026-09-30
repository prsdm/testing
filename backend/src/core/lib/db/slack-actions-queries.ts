import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantSlackActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantSlackActionsConfig = {
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
};

export async function ensureTenantSlackActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantSlackActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantSlackActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantSlackActionsSettings)
      .where(eq(tenantSlackActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant Slack actions settings"
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
        : "Failed to ensure tenant Slack actions settings"
    );
  }
}

export async function getTenantSlackActionsConfig(
  tenantId: string
): Promise<TenantSlackActionsConfig> {
  const row = await ensureTenantSlackActionsSettings(tenantId);
  return {
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
  };
}

export async function getTenantSlackActionsOAuthCredentials(tenantId: string) {
  const row = await ensureTenantSlackActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_SLACK_CLIENT_ID?.trim();
    const clientSecret = process.env.KIMIRO_MANAGED_SLACK_CLIENT_SECRET?.trim();
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

export async function updateTenantSlackActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    oauthClientId?: string;
    oauthClientSecret?: string;
  }
) {
  await ensureTenantSlackActionsSettings(tenantId);
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

  try {
    const [updated] = await db
      .update(tenantSlackActionsSettings)
      .set(patch)
      .where(eq(tenantSlackActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant Slack actions settings"
    );
  }
}
