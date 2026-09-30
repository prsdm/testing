import { chatModels, getCapabilities } from "@/shared/ai/models";
import {
  DEFAULT_REASONING_EFFORT,
  normalizeReasoningEffortForModel,
  type ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";

export function resolveHeadlessChatReasoningEffort(
  modelId: string
): ReasoningEffortLevel {
  const supportsReasoning = getCapabilities()[modelId]?.reasoning === true;
  if (!supportsReasoning) {
    return "off";
  }

  const catalogEffort = chatModels.find(
    (model) => model.id === modelId
  )?.reasoningEffort;
  if (
    catalogEffort &&
    catalogEffort !== "none" &&
    catalogEffort !== "minimal"
  ) {
    return normalizeReasoningEffortForModel({
      effort: catalogEffort,
      modelId,
      supportsReasoning,
    });
  }

  return normalizeReasoningEffortForModel({
    effort: DEFAULT_REASONING_EFFORT,
    modelId,
    supportsReasoning,
  });
}
