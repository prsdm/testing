import { and, eq, inArray } from "drizzle-orm";
import { getPlatformLlmApiKey } from "@/core/lib/ai/platform-api-keys";
import { resolveHeadlessChatReasoningEffort } from "@/core/lib/ai/resolve-headless-chat-reasoning";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import {
  catalogModelsForProvider,
  formatProviderModelName,
  isWellKnownLlmProvider,
  maskApiKeyHint,
  WELL_KNOWN_LLM_PROVIDERS,
  type WellKnownLlmProvider,
} from "@/shared/ai/llm-providers";
import {
  isDeprecatedModelId,
  resolveCanonicalModelId,
} from "@/shared/ai/model-id-migrations";
import {
  type ChatModel,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  titleModel,
} from "@/shared/ai/models";
import {
  isReasoningEffortLevel,
  normalizeReasoningEffortForModel,
  type ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import {
  tenantLlmModelConfigurations,
  tenantLlmProviders,
  tenantLlmSettings,
} from "./tables";

const db = getDb();

export type TenantLlmProviderView = {
  id: string;
  provider: WellKnownLlmProvider;
  configured: boolean;
  keyHint: string | null;
  models: Array<{
    id: string;
    modelId: string;
    displayName: string;
    isVisible: boolean;
  }>;
};

export type TenantLlmAdminView = {
  providers: TenantLlmProviderView[];
  defaults: {
    defaultChatModelId: string | null;
    defaultChatReasoningEffort: string | null;
    defaultTitleModelId: string | null;
  };
  wellKnownProviders: WellKnownLlmProvider[];
  availableChatModels: ChatModel[];
};

export type ResolvedTenantLlmKeys = {
  openai: string | null;
  anthropic: string | null;
  google: string | null;
};

async function ensureTenantLlmSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(tenantLlmSettings)
    .where(eq(tenantLlmSettings.tenantId, tenantId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(tenantLlmSettings)
    .values({ tenantId })
    .onConflictDoNothing({ target: tenantLlmSettings.tenantId })
    .returning();
  if (created) {
    return created;
  }
  const [again] = await db
    .select()
    .from(tenantLlmSettings)
    .where(eq(tenantLlmSettings.tenantId, tenantId))
    .limit(1);
  if (!again) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ensure tenant LLM settings"
    );
  }
  return again;
}

async function seedModelConfigurationsForProvider(llmProviderId: string) {
  const [providerRow] = await db
    .select()
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.id, llmProviderId))
    .limit(1);
  if (!providerRow || !isWellKnownLlmProvider(providerRow.provider)) {
    return;
  }

  const catalog = catalogModelsForProvider(providerRow.provider);
  if (catalog.length === 0) {
    return;
  }

  // Concurrent login/setup can race here; ignore duplicates on unique
  // (llmProviderId, modelId).
  await db
    .insert(tenantLlmModelConfigurations)
    .values(
      catalog.map((model) => ({
        displayName: model.name,
        isVisible: true,
        llmProviderId,
        modelId: model.id,
      }))
    )
    .onConflictDoNothing({
      target: [
        tenantLlmModelConfigurations.llmProviderId,
        tenantLlmModelConfigurations.modelId,
      ],
    });
}

/** Adds catalog models missing from tenant provider configuration rows. */
async function migrateDeprecatedTenantModelIds(tenantId: string) {
  const settings = await ensureTenantLlmSettings(tenantId);
  const settingsPatch: Record<string, unknown> = {};

  if (
    settings.defaultChatModelId &&
    isDeprecatedModelId(settings.defaultChatModelId)
  ) {
    settingsPatch.defaultChatModelId = resolveCanonicalModelId(
      settings.defaultChatModelId
    );
  }
  if (
    settings.defaultTitleModelId &&
    isDeprecatedModelId(settings.defaultTitleModelId)
  ) {
    settingsPatch.defaultTitleModelId = resolveCanonicalModelId(
      settings.defaultTitleModelId
    );
  }

  if (Object.keys(settingsPatch).length > 0) {
    settingsPatch.updatedAt = new Date();
    await db
      .update(tenantLlmSettings)
      .set(settingsPatch)
      .where(eq(tenantLlmSettings.tenantId, tenantId));
  }

  const providerRows = await db
    .select({ id: tenantLlmProviders.id })
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));

  for (const providerRow of providerRows) {
    const configurations = await db
      .select()
      .from(tenantLlmModelConfigurations)
      .where(eq(tenantLlmModelConfigurations.llmProviderId, providerRow.id));

    const configurationsByModelId = new Map(
      configurations.map((config) => [config.modelId, config] as const)
    );

    for (const config of configurations) {
      if (!isDeprecatedModelId(config.modelId)) {
        continue;
      }

      const targetModelId = resolveCanonicalModelId(config.modelId);
      const existingTarget = configurationsByModelId.get(targetModelId);

      if (existingTarget && existingTarget.id !== config.id) {
        if (config.isVisible && !existingTarget.isVisible) {
          await db
            .update(tenantLlmModelConfigurations)
            .set({ isVisible: true, updatedAt: new Date() })
            .where(eq(tenantLlmModelConfigurations.id, existingTarget.id));
        }

        await db
          .delete(tenantLlmModelConfigurations)
          .where(eq(tenantLlmModelConfigurations.id, config.id));
        configurationsByModelId.delete(config.modelId);
        continue;
      }

      const catalogModel = enrichCatalogModel(targetModelId);
      await db
        .update(tenantLlmModelConfigurations)
        .set({
          displayName: catalogModel?.name ?? config.displayName,
          modelId: targetModelId,
          updatedAt: new Date(),
        })
        .where(eq(tenantLlmModelConfigurations.id, config.id));

      configurationsByModelId.delete(config.modelId);
      configurationsByModelId.set(targetModelId, {
        ...config,
        displayName: catalogModel?.name ?? config.displayName,
        modelId: targetModelId,
      });
    }
  }
}

async function ensureTenantCatalogModelsSynced(tenantId: string) {
  await migrateDeprecatedTenantModelIds(tenantId);

  const providerRows = await db
    .select({
      id: tenantLlmProviders.id,
      provider: tenantLlmProviders.provider,
    })
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));

  for (const row of providerRows) {
    if (isWellKnownLlmProvider(row.provider)) {
      await seedModelConfigurationsForProvider(row.id);
    }
  }
}

function enrichCatalogModel(modelId: string): ChatModel | null {
  const canonicalModelId = resolveCanonicalModelId(modelId);
  const catalog = WELL_KNOWN_LLM_PROVIDERS.flatMap((provider) =>
    catalogModelsForProvider(provider)
  );
  const found = catalog.find((model) => model.id === canonicalModelId);
  if (found) {
    return found;
  }
  if (canonicalModelId === titleModel.id) {
    return {
      description: titleModel.description,
      id: titleModel.id,
      name: titleModel.name,
      provider: "openai" as const,
    };
  }
  return null;
}

/** Ensure provider rows + catalog models exist when platform env keys are set. */
async function ensurePlatformManagedLlmProviders(tenantId: string) {
  for (const provider of WELL_KNOWN_LLM_PROVIDERS) {
    if (!getPlatformLlmApiKey(provider)) {
      continue;
    }

    const [existing] = await db
      .select()
      .from(tenantLlmProviders)
      .where(
        and(
          eq(tenantLlmProviders.tenantId, tenantId),
          eq(tenantLlmProviders.provider, provider)
        )
      )
      .limit(1);

    if (existing) {
      await seedModelConfigurationsForProvider(existing.id);
      continue;
    }

    // Concurrent SSO/login requests can both try to seed the same provider.
    // Unique on (tenantId, provider) — ignore conflicts and re-select.
    const [created] = await db
      .insert(tenantLlmProviders)
      .values({
        apiBase: null,
        apiKeyEncrypted: null,
        provider,
        tenantId,
      })
      .onConflictDoNothing({
        target: [tenantLlmProviders.tenantId, tenantLlmProviders.provider],
      })
      .returning();

    const providerRow =
      created ??
      (
        await db
          .select()
          .from(tenantLlmProviders)
          .where(
            and(
              eq(tenantLlmProviders.tenantId, tenantId),
              eq(tenantLlmProviders.provider, provider)
            )
          )
          .limit(1)
      ).at(0);

    if (providerRow) {
      await seedModelConfigurationsForProvider(providerRow.id);
    }
  }
}

export async function resolveTenantLlmKeys(
  tenantId: string
): Promise<ResolvedTenantLlmKeys> {
  const rows = await db
    .select()
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));

  const keys: ResolvedTenantLlmKeys = {
    anthropic: null,
    google: null,
    openai: null,
  };

  for (const row of rows) {
    if (!isWellKnownLlmProvider(row.provider) || !row.apiKeyEncrypted) {
      continue;
    }
    keys[row.provider] = decryptSecret(row.apiKeyEncrypted);
  }

  for (const provider of WELL_KNOWN_LLM_PROVIDERS) {
    if (!keys[provider]) {
      keys[provider] = getPlatformLlmApiKey(provider);
    }
  }

  return keys;
}

function providerHasEffectiveKey(
  provider: WellKnownLlmProvider,
  keys: ResolvedTenantLlmKeys
) {
  return Boolean(keys[provider]);
}

export async function listTenantAvailableChatModels(
  tenantId: string
): Promise<ChatModel[]> {
  await ensurePlatformManagedLlmProviders(tenantId);
  await ensureTenantCatalogModelsSynced(tenantId);
  const keys = await resolveTenantLlmKeys(tenantId);
  const providerRows = await db
    .select()
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));

  const providerByName = new Map(
    providerRows
      .filter((row) => isWellKnownLlmProvider(row.provider))
      .map((row) => [row.provider, row] as const)
  );

  const models: ChatModel[] = [];
  const activeProviderRows = providerRows.filter(
    (row) =>
      isWellKnownLlmProvider(row.provider) &&
      providerHasEffectiveKey(row.provider, keys)
  );
  const activeProviderIds = activeProviderRows.map((row) => row.id);
  const configurationRows =
    activeProviderIds.length > 0
      ? await db
          .select()
          .from(tenantLlmModelConfigurations)
          .where(
            inArray(
              tenantLlmModelConfigurations.llmProviderId,
              activeProviderIds
            )
          )
      : [];
  const configurationsByProvider = new Map<
    string,
    (typeof configurationRows)[number][]
  >();
  for (const config of configurationRows) {
    const current = configurationsByProvider.get(config.llmProviderId) ?? [];
    current.push(config);
    configurationsByProvider.set(config.llmProviderId, current);
  }

  for (const provider of WELL_KNOWN_LLM_PROVIDERS) {
    if (!providerHasEffectiveKey(provider, keys)) {
      continue;
    }

    const providerRow = providerByName.get(provider);
    if (!providerRow) {
      continue;
    }

    const configurations = configurationsByProvider.get(providerRow.id) ?? [];
    for (const config of configurations) {
      if (!config.isVisible || config.modelId === titleModel.id) {
        continue;
      }
      const catalogModel = enrichCatalogModel(config.modelId);
      if (!catalogModel) {
        continue;
      }
      models.push({
        ...catalogModel,
        name: formatProviderModelName(catalogModel.provider, catalogModel.name),
      });
    }
  }

  return models;
}

export async function resolveTenantDefaultChatModelId(
  tenantId: string
): Promise<string> {
  const available = await listTenantAvailableChatModels(tenantId);
  const availableIds = new Set(available.map((model) => model.id));
  const settings = await ensureTenantLlmSettings(tenantId);

  if (
    settings.defaultChatModelId &&
    availableIds.has(settings.defaultChatModelId)
  ) {
    return settings.defaultChatModelId;
  }
  if (availableIds.has(DEFAULT_CHAT_MODEL)) {
    return DEFAULT_CHAT_MODEL;
  }
  return available[0]?.id ?? DEFAULT_CHAT_MODEL;
}

export function resolveTenantDefaultChatReasoningEffort(args: {
  modelId: string;
  savedEffort: string | null | undefined;
}): ReasoningEffortLevel {
  const supportsReasoning = getCapabilities()[args.modelId]?.reasoning === true;
  if (
    args.savedEffort &&
    isReasoningEffortLevel(args.savedEffort) &&
    supportsReasoning
  ) {
    return normalizeReasoningEffortForModel({
      effort: args.savedEffort,
      modelId: args.modelId,
      supportsReasoning,
    });
  }

  return resolveHeadlessChatReasoningEffort(args.modelId);
}

export async function resolveTenantDefaultChatTurnSettings(tenantId: string) {
  const settings = await ensureTenantLlmSettings(tenantId);
  const modelId = await resolveTenantDefaultChatModelId(tenantId);

  return {
    modelId,
    reasoningEffort: resolveTenantDefaultChatReasoningEffort({
      modelId,
      savedEffort: settings.defaultChatReasoningEffort,
    }),
  };
}

export async function getTenantLlmAdminView(
  tenantId: string
): Promise<TenantLlmAdminView> {
  const settings = await ensureTenantLlmSettings(tenantId);
  await ensurePlatformManagedLlmProviders(tenantId);
  await ensureTenantCatalogModelsSynced(tenantId);
  const providerRows = await db
    .select()
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));

  const providerIds = providerRows.map((row) => row.id);
  const configurationRows =
    providerIds.length > 0
      ? await db
          .select()
          .from(tenantLlmModelConfigurations)
          .where(
            inArray(tenantLlmModelConfigurations.llmProviderId, providerIds)
          )
      : [];

  const configurationsByProvider = new Map<
    string,
    (typeof configurationRows)[number][]
  >();
  for (const config of configurationRows) {
    const current = configurationsByProvider.get(config.llmProviderId) ?? [];
    current.push(config);
    configurationsByProvider.set(config.llmProviderId, current);
  }

  const providers: TenantLlmProviderView[] = providerRows
    .filter((row) => isWellKnownLlmProvider(row.provider))
    .map((row) => {
      const provider = row.provider;
      const tenantKey = row.apiKeyEncrypted
        ? decryptSecret(row.apiKeyEncrypted)
        : null;
      const effectiveKey = tenantKey ?? getPlatformLlmApiKey(provider);
      const models = (configurationsByProvider.get(row.id) ?? []).map(
        (config) => ({
          displayName: formatProviderModelName(
            provider,
            enrichCatalogModel(config.modelId)?.name ||
              config.displayName?.trim() ||
              config.modelId
          ),
          id: config.id,
          isVisible: config.isVisible,
          modelId: config.modelId,
        })
      );

      return {
        configured: Boolean(effectiveKey),
        id: row.id,
        keyHint: effectiveKey ? maskApiKeyHint(effectiveKey) : null,
        models,
        provider,
      };
    });

  return {
    availableChatModels: await listTenantAvailableChatModels(tenantId),
    defaults: {
      defaultChatModelId: settings.defaultChatModelId,
      defaultChatReasoningEffort: settings.defaultChatReasoningEffort,
      defaultTitleModelId: settings.defaultTitleModelId,
    },
    providers,
    wellKnownProviders: [...WELL_KNOWN_LLM_PROVIDERS],
  };
}

export async function upsertTenantLlmProvider(
  tenantId: string,
  input: {
    provider: WellKnownLlmProvider;
    apiKey?: string;
    clearApiKey?: boolean;
    apiBase?: string | null;
  }
) {
  const [existing] = await db
    .select()
    .from(tenantLlmProviders)
    .where(
      and(
        eq(tenantLlmProviders.tenantId, tenantId),
        eq(tenantLlmProviders.provider, input.provider)
      )
    )
    .limit(1);

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (input.apiBase !== undefined) {
    patch.apiBase = input.apiBase?.trim() || null;
  }
  if (input.clearApiKey) {
    patch.apiKeyEncrypted = null;
  } else if (input.apiKey?.trim()) {
    patch.apiKeyEncrypted = encryptSecret(input.apiKey.trim());
  }

  try {
    let providerRow = existing;
    if (providerRow) {
      const [updated] = await db
        .update(tenantLlmProviders)
        .set(patch)
        .where(eq(tenantLlmProviders.id, providerRow.id))
        .returning();
      providerRow = updated;
    } else {
      const [created] = await db
        .insert(tenantLlmProviders)
        .values({
          apiBase: input.apiBase?.trim() || null,
          apiKeyEncrypted: input.apiKey?.trim()
            ? encryptSecret(input.apiKey.trim())
            : null,
          provider: input.provider,
          tenantId,
        })
        .onConflictDoNothing({
          target: [tenantLlmProviders.tenantId, tenantLlmProviders.provider],
        })
        .returning();

      if (created) {
        providerRow = created;
      } else {
        const [again] = await db
          .select()
          .from(tenantLlmProviders)
          .where(
            and(
              eq(tenantLlmProviders.tenantId, tenantId),
              eq(tenantLlmProviders.provider, input.provider)
            )
          )
          .limit(1);
        if (!again) {
          throw new Error("Failed to upsert tenant LLM provider");
        }
        const [updated] = await db
          .update(tenantLlmProviders)
          .set(patch)
          .where(eq(tenantLlmProviders.id, again.id))
          .returning();
        providerRow = updated;
      }
    }

    await seedModelConfigurationsForProvider(providerRow.id);
    return providerRow;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to upsert tenant LLM provider"
    );
  }
}

export async function deleteTenantLlmProvider(
  tenantId: string,
  provider: WellKnownLlmProvider
) {
  try {
    await db
      .delete(tenantLlmProviders)
      .where(
        and(
          eq(tenantLlmProviders.tenantId, tenantId),
          eq(tenantLlmProviders.provider, provider)
        )
      );
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to delete tenant LLM provider"
    );
  }
}

export async function updateTenantLlmDefaults(
  tenantId: string,
  input: {
    defaultChatModelId?: string | null;
    defaultChatReasoningEffort?: ReasoningEffortLevel | null;
    defaultTitleModelId?: string | null;
  }
) {
  await ensureTenantLlmSettings(tenantId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.defaultChatModelId !== undefined) {
    patch.defaultChatModelId = input.defaultChatModelId;
  }
  if (input.defaultChatReasoningEffort !== undefined) {
    patch.defaultChatReasoningEffort = input.defaultChatReasoningEffort;
  }
  if (input.defaultTitleModelId !== undefined) {
    patch.defaultTitleModelId = input.defaultTitleModelId;
  }

  try {
    const [updated] = await db
      .update(tenantLlmSettings)
      .set(patch)
      .where(eq(tenantLlmSettings.tenantId, tenantId))
      .returning();
    return updated;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to update tenant LLM defaults"
    );
  }
}

export async function updateTenantLlmModelVisibility(
  tenantId: string,
  updates: Array<{ configurationId: string; isVisible: boolean }>
) {
  if (updates.length === 0) {
    return;
  }

  const providerRows = await db
    .select({ id: tenantLlmProviders.id })
    .from(tenantLlmProviders)
    .where(eq(tenantLlmProviders.tenantId, tenantId));
  const providerIds = new Set(providerRows.map((row) => row.id));

  for (const update of updates) {
    const [config] = await db
      .select()
      .from(tenantLlmModelConfigurations)
      .where(eq(tenantLlmModelConfigurations.id, update.configurationId))
      .limit(1);
    if (!config || !providerIds.has(config.llmProviderId)) {
      throw new ChatbotError(
        "not_found:api",
        "Model configuration not found for this tenant"
      );
    }

    await db
      .update(tenantLlmModelConfigurations)
      .set({ isVisible: update.isVisible, updatedAt: new Date() })
      .where(eq(tenantLlmModelConfigurations.id, update.configurationId));
  }
}

export async function getTenantLlmProviderApiKey(
  tenantId: string,
  provider: WellKnownLlmProvider
) {
  const [row] = await db
    .select()
    .from(tenantLlmProviders)
    .where(
      and(
        eq(tenantLlmProviders.tenantId, tenantId),
        eq(tenantLlmProviders.provider, provider)
      )
    )
    .limit(1);

  if (row?.apiKeyEncrypted) {
    return decryptSecret(row.apiKeyEncrypted);
  }
  return getPlatformLlmApiKey(provider);
}

export { getTenantAvailableCapabilities } from "@/shared/ai/models";
