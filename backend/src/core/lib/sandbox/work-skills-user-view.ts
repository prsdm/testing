import { resolveTenantSandboxConfig } from "@/core/lib/sandbox/tenant-sandbox";
import {
  getWorkSkillCatalogEntry,
  type WorkSkillCatalogEntry,
} from "@/shared/sandbox/work-skill-catalog";

export type TenantWorkSkillsUserView = {
  skills: WorkSkillCatalogEntry[];
};

export async function getTenantWorkSkillsUserView(
  tenantId: string
): Promise<TenantWorkSkillsUserView> {
  const config = await resolveTenantSandboxConfig(tenantId);
  return {
    skills: config.workSkillIds.map((skillId) =>
      getWorkSkillCatalogEntry(skillId)
    ),
  };
}
