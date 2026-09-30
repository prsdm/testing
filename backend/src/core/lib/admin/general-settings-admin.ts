import {
  getTenantGeneralSettings,
  type TenantGeneralSettingsView,
} from "@/core/lib/db/general-settings-queries";
import { getTenantLlmAdminView } from "@/core/lib/db/llm-provider-queries";
import { getTenantSearchRuntimeSettings } from "@/core/lib/db/search-index-queries";
import type { Tenant } from "@/core/lib/db/tables";
import { getTenantWebSearchAdminView } from "@/core/lib/db/web-search-queries";
import { isSandboxConfigured } from "@/core/lib/sandbox/config";
import { envSearchRuntimeSettings } from "@/core/lib/search/runtime-settings";
import type { ChatModel } from "@/shared/ai/models";
import {
  DEFAULT_SANDBOX_WORK_SKILLS_ENABLED,
  type SandboxWorkSkillsEnabled,
  WORK_SKILL_IDS,
} from "@/shared/sandbox/work-skill-catalog";
import type { WebSearchAutoReadLimit } from "@/shared/web-search/settings";

export type TenantGeneralAdminView = {
  workspace: {
    companyName: string;
    slug: string;
    primaryDomain: string;
    status: Tenant["status"];
    createdAt: string;
  };
  settings: TenantGeneralSettingsView;
  knowledge: {
    indexingEnabled: boolean;
    maxIndexedContentSizeMb: number;
    envAllowsIndexing: boolean;
  };
  models: {
    defaultChatModelId: string | null;
    defaultChatReasoningEffort: string | null;
    availableChatModels: ChatModel[];
  };
  sandbox: {
    enabled: boolean;
    envConfigured: boolean;
    workSkillsEnabled: SandboxWorkSkillsEnabled;
  };
  webSearch: {
    maxAutoReadPages: WebSearchAutoReadLimit;
  };
};

export async function getTenantGeneralAdminView(
  tenant: Tenant
): Promise<TenantGeneralAdminView> {
  const [settings, searchRuntime, llmView, webSearchView] = await Promise.all([
    getTenantGeneralSettings(tenant.id),
    getTenantSearchRuntimeSettings(tenant.id),
    getTenantLlmAdminView(tenant.id),
    getTenantWebSearchAdminView(tenant.id),
  ]);

  return {
    knowledge: {
      envAllowsIndexing: envSearchRuntimeSettings().indexingEnabled,
      indexingEnabled: searchRuntime.indexingEnabled,
      maxIndexedContentSizeMb: searchRuntime.maxIndexedContentSizeMb,
    },
    models: {
      availableChatModels: llmView.availableChatModels,
      defaultChatModelId: llmView.defaults.defaultChatModelId,
      defaultChatReasoningEffort: llmView.defaults.defaultChatReasoningEffort,
    },
    sandbox: {
      enabled: settings.sandboxEnabled,
      envConfigured: isSandboxConfigured(),
      workSkillsEnabled: settings.sandboxEnabled
        ? DEFAULT_SANDBOX_WORK_SKILLS_ENABLED
        : (Object.fromEntries(
            WORK_SKILL_IDS.map((skillId) => [skillId, false])
          ) as SandboxWorkSkillsEnabled),
    },
    settings,
    webSearch: {
      maxAutoReadPages: webSearchView.maxAutoReadPages,
    },
    workspace: {
      companyName: tenant.companyName,
      createdAt: tenant.createdAt.toISOString(),
      primaryDomain: tenant.primaryDomain,
      slug: tenant.slug,
      status: tenant.status,
    },
  };
}
