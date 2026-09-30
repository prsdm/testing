import type { IntegrationKey } from "@/shared/integrations/integration-catalog";

/** Tool IDs to hide from connected providers when an integration is latent. */
export const BLOCKED_TOOL_IDS_BY_LATENT_INTEGRATION: Partial<
  Record<IntegrationKey, readonly string[]>
> = {};

export function getBlockedToolIdsForLatentIntegrations(
  latentIntegrationKeys: IntegrationKey[]
): Set<string> {
  const blocked = new Set<string>();

  for (const integrationKey of latentIntegrationKeys) {
    const toolIds = BLOCKED_TOOL_IDS_BY_LATENT_INTEGRATION[integrationKey];
    if (!toolIds) {
      continue;
    }
    for (const toolId of toolIds) {
      blocked.add(toolId);
    }
  }

  return blocked;
}
