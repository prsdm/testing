import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  type TenantGeneralSettings,
  tenantGeneralSettings,
  tenants,
} from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";
import {
  normalizeSandboxWorkSkillsEnabled,
  type SandboxWorkSkillsEnabled,
} from "@/shared/sandbox/work-skill-catalog";

const db = getDb();

export type TenantGeneralSettingsView = {
  workspacePrompt: string | null;
  logoUrl: string | null;
  maximumChatRetentionDays: number | null;
  sandboxEnabled: boolean;
  sandboxWorkSkillsEnabled: SandboxWorkSkillsEnabled;
};

export type WorkspaceView = {
  companyName: string;
  slug: string;
  logoUrl: string | null;
};

const emptySettings: TenantGeneralSettingsView = {
  logoUrl: null,
  maximumChatRetentionDays: null,
  sandboxEnabled: true,
  sandboxWorkSkillsEnabled: normalizeSandboxWorkSkillsEnabled(null),
  workspacePrompt: null,
};

function toView(
  row: TenantGeneralSettings | undefined
): TenantGeneralSettingsView {
  if (!row) {
    return emptySettings;
  }
  return {
    logoUrl: row.logoUrl,
    maximumChatRetentionDays: row.maximumChatRetentionDays,
    sandboxEnabled: row.sandboxEnabled,
    sandboxWorkSkillsEnabled: normalizeSandboxWorkSkillsEnabled(
      row.sandboxWorkSkillsEnabled
    ),
    workspacePrompt: row.workspacePrompt,
  };
}

export async function ensureTenantGeneralSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(tenantGeneralSettings)
    .where(eq(tenantGeneralSettings.tenantId, tenantId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(tenantGeneralSettings)
    .values({ tenantId })
    .onConflictDoNothing({ target: tenantGeneralSettings.tenantId })
    .returning();
  if (created) {
    return created;
  }
  const [again] = await db
    .select()
    .from(tenantGeneralSettings)
    .where(eq(tenantGeneralSettings.tenantId, tenantId))
    .limit(1);
  if (!again) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ensure tenant general settings"
    );
  }
  return again;
}

export async function getTenantGeneralSettings(
  tenantId: string
): Promise<TenantGeneralSettingsView> {
  const [row] = await db
    .select()
    .from(tenantGeneralSettings)
    .where(eq(tenantGeneralSettings.tenantId, tenantId))
    .limit(1);
  return toView(row);
}

export async function getWorkspacePrompt(
  tenantId: string
): Promise<string | null> {
  const settings = await getTenantGeneralSettings(tenantId);
  const trimmed = settings.workspacePrompt?.trim();
  return trimmed || null;
}

export async function getWorkspaceView(
  tenantId: string
): Promise<WorkspaceView | null> {
  const [tenant] = await db
    .select({
      companyName: tenants.companyName,
      slug: tenants.slug,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    return null;
  }

  const [settings] = await db
    .select({ logoUrl: tenantGeneralSettings.logoUrl })
    .from(tenantGeneralSettings)
    .where(eq(tenantGeneralSettings.tenantId, tenantId))
    .limit(1);

  return {
    companyName: tenant.companyName,
    logoUrl: settings?.logoUrl ?? null,
    slug: tenant.slug,
  };
}

export async function getWorkspaceLogoUrlsByTenantIds(
  tenantIds: string[]
): Promise<Map<string, string | null>> {
  const logoByTenantId = new Map<string, string | null>();
  for (const tenantId of tenantIds) {
    logoByTenantId.set(tenantId, null);
  }
  if (tenantIds.length === 0) {
    return logoByTenantId;
  }

  const rows = await db
    .select({
      logoUrl: tenantGeneralSettings.logoUrl,
      tenantId: tenantGeneralSettings.tenantId,
    })
    .from(tenantGeneralSettings)
    .where(inArray(tenantGeneralSettings.tenantId, tenantIds));

  for (const row of rows) {
    logoByTenantId.set(row.tenantId, row.logoUrl);
  }
  return logoByTenantId;
}

export async function updateTenantCompanyName(
  tenantId: string,
  companyName: string
) {
  try {
    const [updated] = await db
      .update(tenants)
      .set({
        companyName: companyName.trim(),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning({ id: tenants.id });
    return updated ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to update workspace name"
    );
  }
}

export async function updateTenantGeneralSettings(
  tenantId: string,
  input: {
    workspacePrompt?: string | null;
    logoUrl?: string | null;
    maximumChatRetentionDays?: number | null;
    sandboxEnabled?: boolean;
    sandboxWorkSkillsEnabled?: SandboxWorkSkillsEnabled;
  }
) {
  await ensureTenantGeneralSettings(tenantId);
  try {
    const [updated] = await db
      .update(tenantGeneralSettings)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(tenantGeneralSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update workspace settings"
    );
  }
}

export async function listTenantsWithChatRetention() {
  return await db
    .select({
      maximumChatRetentionDays: tenantGeneralSettings.maximumChatRetentionDays,
      tenantId: tenantGeneralSettings.tenantId,
    })
    .from(tenantGeneralSettings)
    .innerJoin(tenants, eq(tenants.id, tenantGeneralSettings.tenantId))
    .where(
      and(
        eq(tenants.status, "active"),
        isNotNull(tenantGeneralSettings.maximumChatRetentionDays)
      )
    );
}
