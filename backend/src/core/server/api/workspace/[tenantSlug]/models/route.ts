import {
  getTenantAvailableCapabilities,
  listTenantAvailableChatModels,
  resolveTenantDefaultChatTurnSettings,
} from "@/core/lib/db/llm-provider-queries";
import { isTenantWebSearchConfigured } from "@/core/lib/db/web-search-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const tenantId = authResult.tenant.id;
  const [models, defaults, webSearchConfigured] = await Promise.all([
    listTenantAvailableChatModels(tenantId),
    resolveTenantDefaultChatTurnSettings(tenantId),
    isTenantWebSearchConfigured(tenantId),
  ]);

  return Response.json(
    {
      capabilities: getTenantAvailableCapabilities(models),
      defaultChatModelId: defaults.modelId,
      defaultChatReasoningEffort: defaults.reasoningEffort,
      models,
      webSearchConfigured,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
