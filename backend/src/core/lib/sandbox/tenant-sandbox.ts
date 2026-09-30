import { getTenantGeneralSettings } from "@/core/lib/db/general-settings-queries";
import { isSandboxConfigured } from "@/core/lib/sandbox/config";
import {
  WORK_SKILL_IDS,
  type WorkSkillId,
} from "@/shared/sandbox/work-skill-catalog";

export type TenantSandboxConfig = {
  enabled: boolean;
  workSkillIds: WorkSkillId[];
};

export async function resolveTenantSandboxConfig(
  tenantId: string
): Promise<TenantSandboxConfig> {
  if (!isSandboxConfigured()) {
    return { enabled: false, workSkillIds: [] };
  }

  const settings = await getTenantGeneralSettings(tenantId);
  if (!settings.sandboxEnabled) {
    return { enabled: false, workSkillIds: [] };
  }

  return {
    enabled: true,
    workSkillIds: [...WORK_SKILL_IDS],
  };
}

/** @deprecated Use resolveTenantSandboxConfig */
export async function resolveTenantSandboxEnabled(
  tenantId: string
): Promise<boolean> {
  const config = await resolveTenantSandboxConfig(tenantId);
  return config.enabled;
}
