"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelCapabilities } from "@/shared/ai/models";
import {
  DEFAULT_REASONING_EFFORT,
  type ModelReasoningPreferences,
  modelSupportsReasoning,
  normalizeReasoningEffortForModel,
  parseModelReasoningPreferences,
  parseReasoningEffort,
  REASONING_EFFORT_BY_MODEL_COOKIE,
  REASONING_EFFORT_COOKIE,
  type ReasoningEffortLevel,
  resolveEffortForModelPreferences,
  serializeModelReasoningPreferences,
  withModelReasoningPreference,
} from "@/shared/ai/reasoning-effort";

function readChatModelCookie(): string | null {
  const cookieModel = document.cookie
    .split("; ")
    .find((row) => row.startsWith("chat-model="))
    ?.split("=")[1];
  return cookieModel ? decodeURIComponent(cookieModel) : null;
}

function readReasoningEffortCookie(): ReasoningEffortLevel {
  const effortCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${REASONING_EFFORT_COOKIE}=`))
    ?.split("=")[1];

  if (effortCookie) {
    return parseReasoningEffort(decodeURIComponent(effortCookie));
  }

  const legacyThinking = document.cookie
    .split("; ")
    .find((row) => row.startsWith("chat-thinking="))
    ?.split("=")[1];

  if (legacyThinking === "1") {
    return DEFAULT_REASONING_EFFORT;
  }
  if (legacyThinking === "0") {
    return "off";
  }

  return DEFAULT_REASONING_EFFORT;
}

function readModelReasoningPreferencesCookie(): ModelReasoningPreferences {
  const preferencesCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${REASONING_EFFORT_BY_MODEL_COOKIE}=`))
    ?.split("=")[1];

  const preferences = parseModelReasoningPreferences(preferencesCookie);
  if (Object.keys(preferences).length > 0) {
    return preferences;
  }

  const legacyEffort = readReasoningEffortCookie();
  const legacyModelId = readChatModelCookie();
  if (!legacyModelId || legacyEffort === "off") {
    return preferences;
  }

  return {
    [legacyModelId]: legacyEffort,
  };
}

function writeModelReasoningPreferencesCookie(
  preferences: ModelReasoningPreferences
) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${REASONING_EFFORT_BY_MODEL_COOKIE}=${serializeModelReasoningPreferences(preferences)}; path=/; max-age=${maxAge}`;
}

export function useModelReasoningPreferences(
  selectedModelId: string,
  capabilities: Record<string, ModelCapabilities>
) {
  const [modelReasoningPreferences, setModelReasoningPreferences] =
    useState<ModelReasoningPreferences>({});
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffortLevel>("off");

  useEffect(() => {
    const preferences = readModelReasoningPreferencesCookie();
    setModelReasoningPreferences(preferences);
  }, []);

  useEffect(() => {
    const supportsReasoning = modelSupportsReasoning(
      selectedModelId,
      capabilities
    );
    const effort = resolveEffortForModelPreferences(
      modelReasoningPreferences,
      selectedModelId,
      supportsReasoning
    );
    setReasoningEffort(effort);
  }, [capabilities, modelReasoningPreferences, selectedModelId]);

  const updateModelReasoningPreference = useCallback(
    (
      modelId: string,
      effort: ReasoningEffortLevel,
      supportsReasoning: boolean
    ) => {
      const normalized = normalizeReasoningEffortForModel({
        effort,
        modelId,
        supportsReasoning,
      });

      setModelReasoningPreferences((current) => {
        const next = withModelReasoningPreference(
          current,
          modelId,
          normalized,
          supportsReasoning
        );
        writeModelReasoningPreferencesCookie(next);
        return next;
      });

      if (modelId === selectedModelId) {
        setReasoningEffort(normalized);
        const maxAge = 60 * 60 * 24 * 365;
        // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
        document.cookie = `${REASONING_EFFORT_COOKIE}=${normalized}; path=/; max-age=${maxAge}`;
      }
    },
    [selectedModelId]
  );

  const setCookie = useCallback((name: string, value: string) => {
    const maxAge = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`;
  }, []);

  return {
    modelReasoningPreferences,
    reasoningEffort,
    setCookie,
    updateModelReasoningPreference,
  };
}
