import { listTenantAvailableChatModels } from "@/core/lib/db/llm-provider-queries";
import { resolveCanonicalModelId } from "@/shared/ai/model-id-migrations";

export async function tenantChatModelAvailabilityError(
  tenantId: string,
  modelId: string | null | undefined
): Promise<Response | null> {
  if (modelId === null || modelId === undefined) {
    return null;
  }

  const canonicalModelId = resolveCanonicalModelId(modelId);
  const available = await listTenantAvailableChatModels(tenantId);
  if (available.some((model) => model.id === canonicalModelId)) {
    return null;
  }

  return Response.json(
    { error: "The selected model is not available for this workspace." },
    { status: 400 }
  );
}
