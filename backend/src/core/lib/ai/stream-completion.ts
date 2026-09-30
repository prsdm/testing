import { streamText } from "ai";
import { getLanguageModel } from "@/core/lib/ai/providers";
import {
  recordStreamTextUsage,
  type StreamBillingContext,
} from "@/core/lib/billing/record-stream-usage";
import type { ResolvedTenantLlmKeys } from "@/core/lib/db/llm-provider-queries";
import { resolveCanonicalModelId } from "@/shared/ai/model-id-migrations";

/** Stream a one-shot AI SDK completion for artifact drafting. */
export async function streamCompletionText(args: {
  modelId: string;
  llmKeys: ResolvedTenantLlmKeys;
  system: string;
  prompt: string;
  onTextDelta?: (delta: string) => void | Promise<void>;
  billing?: Pick<StreamBillingContext, "tenantId" | "authUserId" | "chatId">;
}): Promise<string> {
  const modelId = resolveCanonicalModelId(args.modelId);
  const result = streamText({
    model: getLanguageModel(modelId, args.llmKeys),
    prompt: args.prompt,
    system: args.system,
  });

  let text = "";
  for await (const delta of result.textStream) {
    text += delta;
    await args.onTextDelta?.(delta);
  }

  if (args.billing) {
    await recordStreamTextUsage({
      ...args.billing,
      modelId,
      source: "artifact",
      totalUsage: await result.totalUsage,
    });
  }
  return text;
}
