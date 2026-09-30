export const DEFAULT_CHAT_MODEL = "openai/gpt-5.6-luna";

export const titleModel = {
  description: "Fast model for title generation",
  id: "openai/gpt-4o-mini",
  name: "GPT-4o mini",
  provider: "openai",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  description: string;
  /** Passed to OpenAI as `providerOptions.openai.reasoningEffort`. */
  reasoningEffort?:
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";
};

/** Declared capabilities (no gateway catalog fetch). */
const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  "anthropic/claude-fable-5": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "anthropic/claude-haiku-4-5": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "anthropic/claude-opus-4-8": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "anthropic/claude-sonnet-5": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "google/gemini-3-flash-preview": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "google/gemini-3.1-flash-lite": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "google/gemini-3.1-pro-preview": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "google/gemini-3.5-flash": {
    reasoning: true,
    tools: true,
    vision: true,
  },
  "openai/gpt-4.1": { reasoning: false, tools: true, vision: true },
  "openai/gpt-4o": { reasoning: false, tools: true, vision: true },
  "openai/gpt-5": { reasoning: true, tools: true, vision: true },
  "openai/gpt-5.1": { reasoning: true, tools: true, vision: true },
  "openai/gpt-5.2": { reasoning: true, tools: true, vision: true },
  "openai/gpt-5.4": { reasoning: true, tools: true, vision: true },
  "openai/gpt-5.5": { reasoning: true, tools: true, vision: true },
  "openai/gpt-5.6-luna": { reasoning: true, tools: true, vision: true },
};

export const chatModels: ChatModel[] = [
  {
    description: "OpenAI flagship multimodal model",
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
  },
  {
    description: "Updated GPT-4 class model",
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
  },
  {
    description: "GPT-5.1 with configurable reasoning",
    id: "openai/gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "OpenAI GPT-5 flagship",
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "GPT-5.2 with improved reasoning",
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "Latest GPT-5.4 frontier model",
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "Newest GPT-5.5 frontier model",
    id: "openai/gpt-5.5",
    name: "GPT-5.5",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "GPT-5.6 Luna with extended reasoning levels",
    id: "openai/gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "openai",
    reasoningEffort: "medium",
  },
  {
    description: "Next-generation intelligence for long-running agents",
    id: "anthropic/claude-fable-5",
    name: "Fable 5",
    provider: "anthropic",
  },
  {
    description: "Complex agentic coding and enterprise work",
    id: "anthropic/claude-opus-4-8",
    name: "Opus 4.8",
    provider: "anthropic",
  },
  {
    description: "Best combination of speed and intelligence",
    id: "anthropic/claude-sonnet-5",
    name: "Sonnet 5",
    provider: "anthropic",
  },
  {
    description: "Fastest model with near-frontier intelligence",
    id: "anthropic/claude-haiku-4-5",
    name: "Haiku 4.5",
    provider: "anthropic",
  },
  {
    description: "Google flagship preview model",
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
  },
  {
    description: "Fast Gemini 3.5 model",
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
  },
  {
    description: "Lightweight, cost-efficient Gemini 3.1 model",
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "google",
  },
  {
    description: "Fast Gemini 3 preview model",
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      MODEL_CAPABILITIES[model.id] ?? {
        reasoning: false,
        tools: false,
        vision: false,
      },
    ])
  );
}

export function getTenantAvailableCapabilities(models: ChatModel[]) {
  const allCapabilities = getCapabilities();
  return Object.fromEntries(
    models.map((model) => [
      model.id,
      allCapabilities[model.id] ?? {
        reasoning: false,
        tools: false,
        vision: false,
      },
    ])
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

/**
 * Previously returned extra models from Vercel AI Gateway in demo mode.
 * OpenAI / Anthropic are configured explicitly in {@link chatModels}.
 */
export function getAllGatewayModels(): GatewayModelWithCapabilities[] {
  return [];
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
