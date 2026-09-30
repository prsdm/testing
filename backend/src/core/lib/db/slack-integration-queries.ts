import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import {
  getSlackIntegrationEventsRequestUrl,
  getSlackIntegrationInteractionsRequestUrl,
} from "@/core/lib/slack-integration/oauth";
import { SLACK_INTEGRATION_SETUP_SCOPE_LINES } from "@/core/lib/slack-integration/scopes";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { tenantSlackIntegrationSettings } from "./tables";

const db = getDb();
type CredentialMode = "managed" | "own";

export type TenantSlackIntegrationAdminView = {
  enabled: boolean;
  dmsEnabled: boolean;
  deliverablesEnabled: boolean;
  allowedChannelIds: string[];
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  hasSigningSecret: boolean;
  oauthConfigured: boolean;
  managedOAuthAvailable: boolean;
  installed: boolean;
  slackTeamId: string | null;
  slackTeamName: string | null;
  botUserId: string | null;
  installedAt: string | null;
  eventsRequestUrl: string;
  interactionsRequestUrl: string;
  oauthRedirectUri: string;
  botScopeLines: string;
};

function normalizeChannelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    ),
  ];
}

export async function ensureTenantSlackIntegrationSettings(tenantId: string) {
  try {
    const [created] = await db
      .insert(tenantSlackIntegrationSettings)
      .values({ tenantId })
      .onConflictDoNothing({
        target: tenantSlackIntegrationSettings.tenantId,
      })
      .returning();
    if (created) {
      return created;
    }

    const [existing] = await db
      .select()
      .from(tenantSlackIntegrationSettings)
      .where(eq(tenantSlackIntegrationSettings.tenantId, tenantId))
      .limit(1);
    if (!existing) {
      throw new ChatbotError(
        "bad_request:database",
        "Failed to ensure tenant Slack integration settings"
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
        : "Failed to ensure tenant Slack integration settings"
    );
  }
}

export async function getTenantSlackIntegrationSettingsByTeamId(
  teamId: string
) {
  const [row] = await db
    .select()
    .from(tenantSlackIntegrationSettings)
    .where(eq(tenantSlackIntegrationSettings.slackTeamId, teamId))
    .limit(1);
  return row ?? null;
}

export function isManagedSlackIntegrationOAuthAvailable() {
  return managedSlackIntegrationCredentials() !== null;
}

function managedSlackIntegrationCredentials() {
  const clientId = process.env.KIMIRO_MANAGED_SLACK_BOT_CLIENT_ID?.trim();
  const clientSecret =
    process.env.KIMIRO_MANAGED_SLACK_BOT_CLIENT_SECRET?.trim();
  const signingSecret =
    process.env.KIMIRO_MANAGED_SLACK_BOT_SIGNING_SECRET?.trim();
  if (!(clientId && clientSecret && signingSecret)) {
    return null;
  }
  return { clientId, clientSecret, signingSecret };
}

export async function getTenantSlackIntegrationOAuthCredentials(
  tenantId: string
) {
  const row = await ensureTenantSlackIntegrationSettings(tenantId);
  const mode: CredentialMode = row.credentialMode === "own" ? "own" : "managed";

  if (mode === "managed") {
    const managed = managedSlackIntegrationCredentials();
    if (!managed) {
      return null;
    }
    return {
      clientId: managed.clientId,
      clientSecret: managed.clientSecret,
      credentialMode: mode,
      settings: row,
      signingSecret: managed.signingSecret,
    };
  }

  if (
    !row.oauthClientId ||
    !row.oauthClientSecretEncrypted ||
    !row.signingSecretEncrypted
  ) {
    return null;
  }

  return {
    clientId: row.oauthClientId,
    clientSecret: decryptSecret(row.oauthClientSecretEncrypted),
    credentialMode: mode,
    settings: row,
    signingSecret: decryptSecret(row.signingSecretEncrypted),
  };
}

export async function getTenantSlackIntegrationSigningSecret(tenantId: string) {
  const credentials = await getTenantSlackIntegrationOAuthCredentials(tenantId);
  return credentials?.signingSecret ?? null;
}

export async function getTenantSlackIntegrationToken(tenantId: string) {
  const row = await ensureTenantSlackIntegrationSettings(tenantId);
  if (!row.botTokenEncrypted) {
    return null;
  }
  return decryptSecret(row.botTokenEncrypted);
}

export async function getTenantSlackIntegrationAdminView(
  tenantId: string
): Promise<TenantSlackIntegrationAdminView> {
  const row = await ensureTenantSlackIntegrationSettings(tenantId);
  const oauthCredentials =
    await getTenantSlackIntegrationOAuthCredentials(tenantId);
  const { getSlackIntegrationOAuthRedirectUri } = await import(
    "@/core/lib/slack-integration/oauth"
  );
  const managedOAuthAvailable = isManagedSlackIntegrationOAuthAvailable();

  return {
    allowedChannelIds: normalizeChannelIds(row.allowedChannelIds),
    botScopeLines: SLACK_INTEGRATION_SETUP_SCOPE_LINES,
    botUserId: row.botUserId ?? null,
    credentialMode: row.credentialMode === "own" ? "own" : "managed",
    deliverablesEnabled: row.deliverablesEnabled,
    dmsEnabled: row.dmsEnabled,
    enabled: row.enabled,
    eventsRequestUrl: getSlackIntegrationEventsRequestUrl(),
    hasOAuthClientSecret: Boolean(row.oauthClientSecretEncrypted),
    hasSigningSecret: Boolean(row.signingSecretEncrypted),
    installed: Boolean(row.botTokenEncrypted && row.slackTeamId),
    installedAt: row.installedAt?.toISOString() ?? null,
    interactionsRequestUrl: getSlackIntegrationInteractionsRequestUrl(),
    managedOAuthAvailable,
    oauthClientId: row.oauthClientId ?? null,
    oauthConfigured: Boolean(oauthCredentials),
    oauthRedirectUri: getSlackIntegrationOAuthRedirectUri(),
    slackTeamId: row.slackTeamId ?? null,
    slackTeamName: row.slackTeamName ?? null,
  };
}

export async function updateTenantSlackIntegrationSettings(
  tenantId: string,
  input: {
    enabled?: boolean;
    dmsEnabled?: boolean;
    deliverablesEnabled?: boolean;
    allowedChannelIds?: string[];
    credentialMode?: CredentialMode;
    oauthClientId?: string;
    oauthClientSecret?: string;
    signingSecret?: string;
  }
) {
  await ensureTenantSlackIntegrationSettings(tenantId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.enabled !== undefined) {
    patch.enabled = input.enabled;
  }
  if (input.dmsEnabled !== undefined) {
    patch.dmsEnabled = input.dmsEnabled;
  }
  if (input.deliverablesEnabled !== undefined) {
    patch.deliverablesEnabled = input.deliverablesEnabled;
  }
  if (input.allowedChannelIds !== undefined) {
    patch.allowedChannelIds = normalizeChannelIds(input.allowedChannelIds);
  }
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
  if (input.signingSecret?.trim()) {
    patch.signingSecretEncrypted = encryptSecret(input.signingSecret.trim());
  }

  const [updated] = await db
    .update(tenantSlackIntegrationSettings)
    .set(patch)
    .where(eq(tenantSlackIntegrationSettings.tenantId, tenantId))
    .returning();
  return updated;
}

export async function saveTenantSlackIntegrationInstall(args: {
  tenantId: string;
  installedByUserId: string;
  slackTeamId: string;
  slackTeamName: string;
  botUserId: string;
  botToken: string;
}) {
  await ensureTenantSlackIntegrationSettings(args.tenantId);
  const [updated] = await db
    .update(tenantSlackIntegrationSettings)
    .set({
      botTokenEncrypted: encryptSecret(args.botToken),
      botUserId: args.botUserId,
      enabled: true,
      installedAt: new Date(),
      installedByUserId: args.installedByUserId,
      slackTeamId: args.slackTeamId,
      slackTeamName: args.slackTeamName,
      updatedAt: new Date(),
    })
    .where(eq(tenantSlackIntegrationSettings.tenantId, args.tenantId))
    .returning();
  return updated;
}

export async function disconnectTenantSlackIntegration(tenantId: string) {
  await ensureTenantSlackIntegrationSettings(tenantId);
  const [updated] = await db
    .update(tenantSlackIntegrationSettings)
    .set({
      botTokenEncrypted: null,
      botUserId: null,
      enabled: false,
      installedAt: null,
      installedByUserId: null,
      slackTeamId: null,
      slackTeamName: null,
      updatedAt: new Date(),
    })
    .where(eq(tenantSlackIntegrationSettings.tenantId, tenantId))
    .returning();
  return updated;
}
