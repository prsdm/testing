import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantJiraActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantJiraActionsConfig = {
  credentialMode: CredentialMode;
  siteUrl: string | null;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
};

function normalizeSiteUrl(siteUrl: string) {
  const trimmed = siteUrl.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    throw new ChatbotError(
      "bad_request:api",
      "Jira site URL must start with https://"
    );
  }
  return trimmed;
}

export async function ensureTenantJiraActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantJiraActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantJiraActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantJiraActionsSettings)
      .where(eq(tenantJiraActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant Jira actions settings"
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
        : "Failed to ensure tenant Jira actions settings"
    );
  }
}

export async function getTenantJiraActionsConfig(
  tenantId: string
): Promise<TenantJiraActionsConfig> {
  const row = await ensureTenantJiraActionsSettings(tenantId);
  return {
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
    siteUrl: row.siteUrl ?? null,
  };
}

export async function getTenantJiraActionsOAuthCredentials(tenantId: string) {
  const row = await ensureTenantJiraActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_JIRA_CLIENT_ID?.trim();
    const clientSecret = process.env.KIMIRO_MANAGED_JIRA_CLIENT_SECRET?.trim();
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

export async function updateTenantJiraActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    siteUrl?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
  }
) {
  await ensureTenantJiraActionsSettings(tenantId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.credentialMode !== undefined) {
    patch.credentialMode = input.credentialMode;
  }
  if (input.siteUrl !== undefined) {
    patch.siteUrl = input.siteUrl.trim()
      ? normalizeSiteUrl(input.siteUrl)
      : null;
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
      .update(tenantJiraActionsSettings)
      .set(patch)
      .where(eq(tenantJiraActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant Jira actions settings"
    );
  }
}
