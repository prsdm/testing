import { chatModels, getCapabilities } from "@/shared/ai/models";
import {
  type ActiveReasoningEffort,
  buildProviderReasoningOptions,
  isReasoningEnabled,
  normalizeReasoningEffortForModel,
  type ReasoningEffortLevel,
  type ReasoningProviderOptions,
  resolveReasoningEffortFromRequest,
} from "@/shared/ai/reasoning-effort";

export function resolveChatReasoningOptions(args: {
  modelId: string;
  reasoningEffort?: ReasoningEffortLevel;
}): {
  effort: ReasoningEffortLevel;
  providerOptions: ReasoningProviderOptions | undefined;
} {
  const supportsReasoning = getCapabilities()[args.modelId]?.reasoning === true;
  const provider =
    chatModels.find((model) => model.id === args.modelId)?.provider ?? "openai";
  const effort = normalizeReasoningEffortForModel({
    effort: resolveReasoningEffortFromRequest({
      reasoningEffort: args.reasoningEffort,
    }),
    modelId: args.modelId,
    supportsReasoning,
  });

  if (!(supportsReasoning && isReasoningEnabled(effort))) {
    return {
      effort: "off",
      providerOptions:
        provider === "openai"
          ? { openai: { parallelToolCalls: true } }
          : undefined,
    };
  }

  return {
    effort,
    providerOptions: buildProviderReasoningOptions({
      effort: effort as ActiveReasoningEffort,
      modelId: args.modelId,
      provider,
    }),
  };
}
