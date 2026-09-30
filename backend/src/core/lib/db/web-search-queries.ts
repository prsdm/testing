import { and, eq } from "drizzle-orm";
import { getPlatformSerperApiKey } from "@/core/lib/ai/platform-api-keys";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { maskApiKeyHint } from "@/shared/ai/llm-providers";
import { ChatbotError } from "@/shared/errors";
import {
  CONTENT_PROVIDERS,
  DEFAULT_CONTENT_PROVIDER_TYPE,
  SEARCH_PROVIDERS,
  type WebContentProviderType,
  type WebSearchProviderCategory,
  type WebSearchProviderType,
} from "@/shared/web-search/providers";
import {
  DEFAULT_WEB_SEARCH_AUTO_READ_LIMIT,
  isWebSearchAutoReadLimit,
  type WebSearchAutoReadLimit,
} from "@/shared/web-search/settings";
import { getDb } from "./client";
import { tenantWebSearchProviders, tenantWebSearchSettings } from "./tables";

const db = getDb();

export type WebSearchProviderView = {
  id: string;
  category: WebSearchProviderCategory;
  providerType: string;
  configured: boolean;
  isActive: boolean;
  keyHint: string | null;
  config: Record<string, string>;
};

export type TenantWebSearchAdminView = {
  searchProviders: WebSearchProviderView[];
  contentProviders: WebSearchProviderView[];
  availableSearchProviders: typeof SEARCH_PROVIDERS;
  availableContentProviders: typeof CONTENT_PROVIDERS;
  defaultContentProviderType: WebContentProviderType;
  maxAutoReadPages: WebSearchAutoReadLimit;
};

export type ResolvedWebSearchProvider = {
  providerType: WebSearchProviderType;
  apiKey: string | null;
  config: Record<string, string>;
};

export type ResolvedWebContentProvider = {
  providerType: WebContentProviderType;
  apiKey: string | null;
  config: Record<string, string>;
};

export type ResolvedTenantWebSearchConfig = {
  search: ResolvedWebSearchProvider | null;
  content: ResolvedWebContentProvider;
  maxAutoReadPages: WebSearchAutoReadLimit;
};

function toView(row: {
  id: string;
  category: WebSearchProviderCategory;
  providerType: string;
  apiKeyEncrypted: string | null;
  isActive: boolean;
  config: Record<string, string> | null;
}): WebSearchProviderView {
  const decrypted = row.apiKeyEncrypted
    ? decryptSecret(row.apiKeyEncrypted)
    : null;
  const platformKey =
    row.category === "search" && row.providerType === "serper"
      ? getPlatformSerperApiKey()
      : null;
  const effectiveKey = decrypted ?? platformKey;
  return {
    category: row.category,
    config: row.config ?? {},
    configured: Boolean(effectiveKey),
    id: row.id,
    isActive: row.isActive,
    keyHint: effectiveKey ? maskApiKeyHint(effectiveKey) : null,
    providerType: row.providerType,
  };
}

async function ensureTenantWebSearchSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(tenantWebSearchSettings)
    .where(eq(tenantWebSearchSettings.tenantId, tenantId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(tenantWebSearchSettings)
    .values({ tenantId })
    .returning();
  return created;
}

/** Create/activate Serper when a platform env key is set and no search provider is active. */
async function ensurePlatformManagedSerper(tenantId: string) {
  if (!getPlatformSerperApiKey()) {
    return;
  }

  const rows = await db
    .select()
    .from(tenantWebSearchProviders)
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.category, "search")
      )
    );

  if (rows.some((row) => row.isActive)) {
    return;
  }

  const existingSerper = rows.find((row) => row.providerType === "serper");
  if (existingSerper) {
    await setActiveWebSearchProvider(tenantId, "search", existingSerper.id);
    return;
  }

  const [created] = await db
    .insert(tenantWebSearchProviders)
    .values({
      apiKeyEncrypted: null,
      category: "search",
      config: {},
      isActive: false,
      providerType: "serper",
      tenantId,
    })
    .returning();
  await setActiveWebSearchProvider(tenantId, "search", created.id);
}

function resolveMaxAutoReadPages(
  value: number | null | undefined
): WebSearchAutoReadLimit {
  if (value != null && isWebSearchAutoReadLimit(value)) {
    return value;
  }
  return DEFAULT_WEB_SEARCH_AUTO_READ_LIMIT;
}

export async function getTenantWebSearchAdminView(
  tenantId: string
): Promise<TenantWebSearchAdminView> {
  await ensurePlatformManagedSerper(tenantId);
  const rows = await db
    .select()
    .from(tenantWebSearchProviders)
    .where(eq(tenantWebSearchProviders.tenantId, tenantId));

  const searchProviders = rows
    .filter((row) => row.category === "search")
    .map(toView);
  const contentProviders = rows
    .filter((row) => row.category === "content")
    .map(toView);
  const settings = await ensureTenantWebSearchSettings(tenantId);

  return {
    availableContentProviders: CONTENT_PROVIDERS,
    availableSearchProviders: SEARCH_PROVIDERS,
    contentProviders,
    defaultContentProviderType: DEFAULT_CONTENT_PROVIDER_TYPE,
    maxAutoReadPages: resolveMaxAutoReadPages(settings.maxAutoReadPages),
    searchProviders,
  };
}

export async function resolveTenantWebSearchConfig(
  tenantId: string
): Promise<ResolvedTenantWebSearchConfig> {
  await ensurePlatformManagedSerper(tenantId);
  const rows = await db
    .select()
    .from(tenantWebSearchProviders)
    .where(eq(tenantWebSearchProviders.tenantId, tenantId));

  const activeSearch = rows.find(
    (row) => row.category === "search" && row.isActive
  );
  const activeContent = rows.find(
    (row) => row.category === "content" && row.isActive
  );

  const platformSerperKey = getPlatformSerperApiKey();
  let search: ResolvedWebSearchProvider | null = activeSearch
    ? {
        apiKey: activeSearch.apiKeyEncrypted
          ? decryptSecret(activeSearch.apiKeyEncrypted)
          : null,
        config: activeSearch.config ?? {},
        providerType: activeSearch.providerType as WebSearchProviderType,
      }
    : null;

  if (search && !search.apiKey && search.providerType === "serper") {
    search = { ...search, apiKey: platformSerperKey };
  } else if (!search && platformSerperKey) {
    search = {
      apiKey: platformSerperKey,
      config: {},
      providerType: "serper",
    };
  }

  const content: ResolvedWebContentProvider = activeContent
    ? {
        apiKey: activeContent.apiKeyEncrypted
          ? decryptSecret(activeContent.apiKeyEncrypted)
          : null,
        config: activeContent.config ?? {},
        providerType: activeContent.providerType as WebContentProviderType,
      }
    : {
        apiKey: null,
        config: {},
        providerType: DEFAULT_CONTENT_PROVIDER_TYPE,
      };

  const settings = await ensureTenantWebSearchSettings(tenantId);

  return {
    content,
    maxAutoReadPages: resolveMaxAutoReadPages(settings.maxAutoReadPages),
    search,
  };
}

/** True when an active search provider has an API key (chat can use webSearch). */
export async function isTenantWebSearchConfigured(
  tenantId: string
): Promise<boolean> {
  const config = await resolveTenantWebSearchConfig(tenantId);
  return Boolean(config.search?.apiKey);
}

export async function upsertTenantWebSearchProvider(
  tenantId: string,
  input: {
    category: WebSearchProviderCategory;
    providerType: string;
    apiKey?: string;
    clearApiKey?: boolean;
    config?: Record<string, string>;
    activate?: boolean;
  }
) {
  const [existing] = await db
    .select()
    .from(tenantWebSearchProviders)
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.category, input.category),
        eq(tenantWebSearchProviders.providerType, input.providerType)
      )
    )
    .limit(1);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.config !== undefined) {
    patch.config = input.config;
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
        .update(tenantWebSearchProviders)
        .set(patch)
        .where(eq(tenantWebSearchProviders.id, providerRow.id))
        .returning();
      providerRow = updated;
    } else {
      const [created] = await db
        .insert(tenantWebSearchProviders)
        .values({
          apiKeyEncrypted: input.apiKey?.trim()
            ? encryptSecret(input.apiKey.trim())
            : null,
          category: input.category,
          config: input.config ?? {},
          isActive: false,
          providerType: input.providerType,
          tenantId,
        })
        .returning();
      providerRow = created;
    }

    if (input.activate) {
      await setActiveWebSearchProvider(
        tenantId,
        input.category,
        providerRow.id
      );
    }

    return providerRow;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error
        ? error.message
        : "Failed to upsert web search provider"
    );
  }
}

export async function setActiveWebSearchProvider(
  tenantId: string,
  category: WebSearchProviderCategory,
  providerId: string
) {
  await db
    .update(tenantWebSearchProviders)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.category, category)
      )
    );

  await db
    .update(tenantWebSearchProviders)
    .set({ isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.id, providerId)
      )
    );
}

export async function getTenantWebSearchProviderApiKey(
  tenantId: string,
  category: WebSearchProviderCategory,
  providerType: string
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(tenantWebSearchProviders)
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.category, category),
        eq(tenantWebSearchProviders.providerType, providerType)
      )
    )
    .limit(1);

  if (row?.apiKeyEncrypted) {
    return decryptSecret(row.apiKeyEncrypted);
  }
  if (category === "search" && providerType === "serper") {
    return getPlatformSerperApiKey();
  }
  return null;
}

export async function deleteTenantWebSearchProvider(
  tenantId: string,
  providerId: string
) {
  await db
    .delete(tenantWebSearchProviders)
    .where(
      and(
        eq(tenantWebSearchProviders.tenantId, tenantId),
        eq(tenantWebSearchProviders.id, providerId)
      )
    );
}

export async function updateTenantWebSearchSettings(
  tenantId: string,
  input: { maxAutoReadPages: WebSearchAutoReadLimit }
) {
  await ensureTenantWebSearchSettings(tenantId);
  await db
    .update(tenantWebSearchSettings)
    .set({
      maxAutoReadPages: input.maxAutoReadPages,
      updatedAt: new Date(),
    })
    .where(eq(tenantWebSearchSettings.tenantId, tenantId));
}
