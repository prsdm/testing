import { allowedModelIds } from "./models";

/**
 * Maps retired catalog model IDs to their canonical replacements.
 * Add entries here whenever {@link chatModels} IDs change.
 */
export const DEPRECATED_MODEL_ID_MIGRATIONS: Record<string, string> = {
  "anthropic/claude-haiku-4-5-20251001": "anthropic/claude-haiku-4-5",
  "anthropic/claude-sonnet-4-6": "anthropic/claude-sonnet-5",
  "openai/gpt-4.1-2025-04-14": "openai/gpt-4.1",
  "openai/gpt-5.4-2026-03-05": "openai/gpt-5.4",
  "openai/gpt-5.4-nano-2026-03-17": "openai/gpt-5.4",
};

export function isDeprecatedModelId(modelId: string): boolean {
  return Object.hasOwn(DEPRECATED_MODEL_ID_MIGRATIONS, modelId);
}

export function resolveCanonicalModelId(modelId: string): string {
  let current = modelId;
  const visited = new Set<string>();

  while (isDeprecatedModelId(current)) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    current = DEPRECATED_MODEL_ID_MIGRATIONS[current];
  }

  return current;
}

export function isAllowedChatModelId(modelId: string): boolean {
  return allowedModelIds.has(resolveCanonicalModelId(modelId));
}
