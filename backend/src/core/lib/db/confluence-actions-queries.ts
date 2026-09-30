import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantConfluenceActionsSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantConfluenceActionsConfig = {
  credentialMode: CredentialMode;
  siteUrl: string | null;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  allowRead: boolean;
};

function normalizeSiteUrl(siteUrl: string) {
  const trimmed = siteUrl.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    throw new ChatbotError(
      "bad_request:api",
      "Confluence site URL must start with https://"
    );
  }
  return trimmed;
}

export async function ensureTenantConfluenceActionsSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantConfluenceActionsSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantConfluenceActionsSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantConfluenceActionsSettings)
      .where(eq(tenantConfluenceActionsSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant Confluence actions settings"
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
        : "Failed to ensure tenant Confluence actions settings"
    );
  }
}

export async function getTenantConfluenceActionsConfig(
  tenantId: string
): Promise<TenantConfluenceActionsConfig> {
  const row = await ensureTenantConfluenceActionsSettings(tenantId);
  return {
    allowRead: row.allowRead,
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    oauthClientId: row.oauthClientId ?? null,
    siteUrl: row.siteUrl ?? null,
  };
}

export async function getTenantConfluenceActionsOAuthCredentials(
  tenantId: string
) {
  const row = await ensureTenantConfluenceActionsSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";
  if (mode === "managed") {
    const clientId = process.env.KIMIRO_MANAGED_CONFLUENCE_CLIENT_ID?.trim();
    const clientSecret =
      process.env.KIMIRO_MANAGED_CONFLUENCE_CLIENT_SECRET?.trim();
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

export async function updateTenantConfluenceActionsSettings(
  tenantId: string,
  input: {
    credentialMode?: CredentialMode;
    siteUrl?: string;
    oauthClientId?: string;
    oauthClientSecret?: string;
    allowRead?: boolean;
  }
) {
  await ensureTenantConfluenceActionsSettings(tenantId);
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
  if (input.allowRead !== undefined) {
    patch.allowRead = input.allowRead;
  }

  try {
    const [updated] = await db
      .update(tenantConfluenceActionsSettings)
      .set(patch)
      .where(eq(tenantConfluenceActionsSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant Confluence actions settings"
    );
  }
}
