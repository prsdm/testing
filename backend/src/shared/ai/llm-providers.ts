import type { ChatModel } from "./models";
import { chatModels, titleModel } from "./models";

export const WELL_KNOWN_LLM_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
] as const;

export type WellKnownLlmProvider = (typeof WELL_KNOWN_LLM_PROVIDERS)[number];

export const LLM_PROVIDER_LABELS: Record<WellKnownLlmProvider, string> = {
  anthropic: "Anthropic",
  google: "Google",
  openai: "OpenAI",
};

export const LLM_PROVIDER_CATALOG: Record<
  WellKnownLlmProvider,
  { productName: string; companyName: string; description: string }
> = {
  anthropic: {
    companyName: "Anthropic",
    description: "Large language models from Anthropic.",
    productName: "Claude",
  },
  google: {
    companyName: "Google AI",
    description: "Large language and multimodal models from Google AI.",
    productName: "Gemini",
  },
  openai: {
    companyName: "OpenAI",
    description: "Large language and multimodal models from OpenAI.",
    productName: "GPT",
  },
};

export function isWellKnownLlmProvider(
  value: string
): value is WellKnownLlmProvider {
  return (WELL_KNOWN_LLM_PROVIDERS as readonly string[]).includes(value);
}

export function formatAnthropicModelName(name: string) {
  return name.replace(/^Claude\s+/i, "").trim();
}

export function formatProviderModelName(
  provider: WellKnownLlmProvider,
  name: string
) {
  if (provider === "anthropic") {
    return formatAnthropicModelName(name);
  }
  return name;
}

export function catalogModelsForProvider(
  provider: WellKnownLlmProvider
): ChatModel[] {
  const models = chatModels.filter((model) => model.provider === provider);
  if (
    provider === "openai" &&
    !models.some((model) => model.id === titleModel.id)
  ) {
    return [
      ...models,
      {
        description: titleModel.description,
        id: titleModel.id,
        name: titleModel.name,
        provider: "openai" as const,
      },
    ];
  }
  return models;
}

export function maskApiKeyHint(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export function isUsingStoredApiKey(
  apiKey: string,
  configured: boolean,
  storedKeyHint: string | null
) {
  if (!configured || !storedKeyHint) {
    return false;
  }
  const trimmed = apiKey.trim();
  return trimmed === "" || trimmed === storedKeyHint;
}
