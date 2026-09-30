import { resolveTenantDefaultChatTurnSettings } from "@/core/lib/db/llm-provider-queries";

export { resolveHeadlessChatReasoningEffort } from "@/core/lib/ai/resolve-headless-chat-reasoning";

/** Slack and other headless chat entrypoints use tenant LLM defaults. */
export async function resolveHeadlessChatTurnModelSettings(tenantId: string) {
  return await resolveTenantDefaultChatTurnSettings(tenantId);
}
