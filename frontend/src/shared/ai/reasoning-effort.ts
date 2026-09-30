import type { ModelCapabilities } from "./models";

export type ReasoningProviderOptions =
  | {
      openai: {
        reasoningEffort?: ActiveReasoningEffort;
        reasoningSummary?: string;
        parallelToolCalls: boolean;
      };
    }
  | {
      anthropic: {
        sendReasoning: boolean;
        effort: "low" | "medium" | "high";
        thinking: {
          type: "adaptive";
          display: "summarized";
        };
      };
    }
  | {
      google: {
        thinkingConfig: {
          includeThoughts: boolean;
          thinkingLevel: "low" | "medium" | "high";
        };
      };
    };

export const REASONING_EFFORT_LEVELS = [
  "off",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number];

export type ActiveReasoningEffort = Exclude<ReasoningEffortLevel, "off">;

export const REASONING_EFFORT_COOKIE = "chat-reasoning-effort";

export const REASONING_EFFORT_BY_MODEL_COOKIE =
  "chat-reasoning-effort-by-model";

export type ModelReasoningPreferences = Record<string, ReasoningEffortLevel>;

export const REASONING_EFFORT_LABELS: Record<ReasoningEffortLevel, string> = {
  high: "High",
  low: "Low",
  max: "Max",
  medium: "Medium",
  off: "Off",
  xhigh: "Extra High",
};

export const DEFAULT_REASONING_EFFORT: ActiveReasoningEffort = "medium";

export function isReasoningEffortLevel(
  value: string
): value is ReasoningEffortLevel {
  return (REASONING_EFFORT_LEVELS as readonly string[]).includes(value);
}

export function parseReasoningEffort(
  value: string | undefined
): ReasoningEffortLevel {
  if (value && isReasoningEffortLevel(value)) {
    return value;
  }
  return "off";
}

export function isReasoningEnabled(effort: ReasoningEffortLevel): boolean {
  return effort !== "off";
}

export function resolveReasoningEffortFromRequest(input: {
  reasoningEffort?: ReasoningEffortLevel;
  reasoningEnabled?: boolean;
}): ReasoningEffortLevel {
  if (input.reasoningEffort !== undefined) {
    return input.reasoningEffort;
  }
  if (input.reasoningEnabled === true) {
    return DEFAULT_REASONING_EFFORT;
  }
  return "off";
}

export function effortLevelsForModel(
  modelId: string,
  supportsReasoning: boolean
): ActiveReasoningEffort[] {
  if (!supportsReasoning) {
    return [];
  }

  if (modelId.startsWith("openai/gpt-5.6-luna")) {
    return ["low", "medium", "high", "xhigh", "max"];
  }

  if (
    modelId.startsWith("openai/gpt-5.4") ||
    modelId.startsWith("openai/gpt-5.5") ||
    modelId.includes("claude-opus-4-8") ||
    modelId.includes("claude-fable-5")
  ) {
    return ["low", "medium", "high", "xhigh"];
  }

  return ["low", "medium", "high"];
}

export function parseModelReasoningPreferences(
  raw: string | undefined
): ModelReasoningPreferences {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    const result: ModelReasoningPreferences = {};
    for (const [modelId, effort] of Object.entries(parsed)) {
      if (typeof effort === "string" && isReasoningEffortLevel(effort)) {
        result[modelId] = effort;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeModelReasoningPreferences(
  preferences: ModelReasoningPreferences
): string {
  return encodeURIComponent(JSON.stringify(preferences));
}

export function resolveEffortForModelPreferences(
  preferences: ModelReasoningPreferences,
  modelId: string,
  supportsReasoning: boolean
): ReasoningEffortLevel {
  const saved = preferences[modelId];
  if (saved === undefined) {
    return "off";
  }

  return normalizeReasoningEffortForModel({
    effort: saved,
    modelId,
    supportsReasoning,
  });
}

export function withModelReasoningPreference(
  preferences: ModelReasoningPreferences,
  modelId: string,
  effort: ReasoningEffortLevel,
  supportsReasoning: boolean
): ModelReasoningPreferences {
  return {
    ...preferences,
    [modelId]: normalizeReasoningEffortForModel({
      effort,
      modelId,
      supportsReasoning,
    }),
  };
}

export function formatModelSelectorLabel(
  modelName: string,
  effort: ReasoningEffortLevel,
  supportsReasoning: boolean
): string {
  if (!supportsReasoning || effort === "off") {
    return modelName;
  }

  return `${modelName} · ${REASONING_EFFORT_LABELS[effort]}`;
}

export function normalizeReasoningEffortForModel(input: {
  modelId: string;
  effort: ReasoningEffortLevel;
  supportsReasoning: boolean;
}): ReasoningEffortLevel {
  if (!input.supportsReasoning) {
    return "off";
  }

  if (input.effort === "off") {
    return "off";
  }

  const allowed = effortLevelsForModel(input.modelId, true);
  if (allowed.includes(input.effort)) {
    return input.effort;
  }

  return DEFAULT_REASONING_EFFORT;
}

export function defaultReasoningEffortForModel(
  supportsReasoning: boolean
): ReasoningEffortLevel {
  if (!supportsReasoning) {
    return "off";
  }

  return DEFAULT_REASONING_EFFORT;
}

export function buildProviderReasoningOptions(input: {
  provider: "openai" | "anthropic" | "google";
  modelId: string;
  effort: ActiveReasoningEffort;
}): ReasoningProviderOptions {
  if (input.provider === "openai") {
    return {
      openai: {
        parallelToolCalls: true,
        reasoningEffort: input.effort,
        reasoningSummary: "auto",
      },
    };
  }

  if (input.provider === "google") {
    return {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingLevel:
            input.effort === "xhigh" || input.effort === "max"
              ? "high"
              : input.effort,
        },
      },
    };
  }

  return {
    anthropic: {
      effort:
        input.effort === "xhigh" || input.effort === "max"
          ? "high"
          : input.effort,
      sendReasoning: true,
      thinking: {
        display: "summarized",
        type: "adaptive",
      },
    },
  };
}

export function modelSupportsReasoning(
  modelId: string,
  capabilities: Record<string, ModelCapabilities> | undefined
): boolean {
  return capabilities?.[modelId]?.reasoning === true;
}
