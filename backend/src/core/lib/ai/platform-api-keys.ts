import type { WellKnownLlmProvider } from "@/shared/ai/llm-providers";

function firstEnv(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

const LLM_ENV_NAMES: Record<WellKnownLlmProvider, string[]> = {
  anthropic: ["KIMIRO_MANAGED_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"],
  google: [
    "KIMIRO_MANAGED_GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_API_KEY",
  ],
  openai: ["KIMIRO_MANAGED_OPENAI_API_KEY", "OPENAI_API_KEY"],
};

/** Platform-managed LLM key (tenant BYOK wins at call sites). */
export function getPlatformLlmApiKey(
  provider: WellKnownLlmProvider
): string | null {
  return firstEnv(LLM_ENV_NAMES[provider]);
}

/** Platform-managed Serper key for web search when tenant has none. */
export function getPlatformSerperApiKey(): string | null {
  return firstEnv([
    "KIMIRO_MANAGED_SERPER_API_KEY",
    "SERPER_API_KEY",
    "SERPER_KEY",
  ]);
}
