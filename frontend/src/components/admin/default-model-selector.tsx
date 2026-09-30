"use client";

import { useEffect, useMemo, useState } from "react";
import { ModelSelectorReasoningFlyout } from "@/components/ai-elements/model-selector-reasoning-flyout";
import { useModelReasoningPreferences } from "@/hooks/use-model-reasoning-preferences";
import {
  type ChatModel,
  getTenantAvailableCapabilities,
} from "@/shared/ai/models";
import {
  normalizeReasoningEffortForModel,
  type ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";

export function DefaultModelSelector({
  models,
  value,
  disabled = false,
  onChange,
  savedReasoningEffort,
  onReasoningEffortChange,
}: {
  models: ChatModel[];
  value: string;
  disabled?: boolean;
  onChange: (modelId: string) => void;
  savedReasoningEffort?: ReasoningEffortLevel | null;
  onReasoningEffortChange?: (effort: ReasoningEffortLevel) => void;
}) {
  const capabilities = useMemo(
    () => getTenantAvailableCapabilities(models),
    [models]
  );
  const internalPreferences = useModelReasoningPreferences(value, capabilities);
  const [tenantReasoningEffort, setTenantReasoningEffort] =
    useState<ReasoningEffortLevel>(savedReasoningEffort ?? "off");

  useEffect(() => {
    if (savedReasoningEffort !== undefined && savedReasoningEffort !== null) {
      setTenantReasoningEffort(savedReasoningEffort);
    }
  }, [savedReasoningEffort]);

  const reasoningEffort = onReasoningEffortChange
    ? tenantReasoningEffort
    : internalPreferences.reasoningEffort;

  const updateModelReasoningPreference = onReasoningEffortChange
    ? (
        modelId: string,
        effort: ReasoningEffortLevel,
        supportsReasoning: boolean
      ) => {
        const normalized = normalizeReasoningEffortForModel({
          effort,
          modelId,
          supportsReasoning,
        });
        if (modelId === value) {
          setTenantReasoningEffort(normalized);
          onReasoningEffortChange(normalized);
        }
      }
    : internalPreferences.updateModelReasoningPreference;

  if (models.length === 0 || !value) {
    return null;
  }

  return (
    <ModelSelectorReasoningFlyout
      activeModels={models}
      capabilities={capabilities}
      disabled={disabled}
      focusOnClose={false}
      isModelsLoaded
      menuSide="bottom"
      modelReasoningPreferences={
        onReasoningEffortChange
          ? { [value]: tenantReasoningEffort }
          : internalPreferences.modelReasoningPreferences
      }
      onModelChange={onChange}
      onModelReasoningPreferenceChange={updateModelReasoningPreference}
      persistChatModelCookie={false}
      reasoningEffort={reasoningEffort}
      selectedModelId={value}
      setCookie={internalPreferences.setCookie}
      triggerAppearance="outline"
      triggerClassName="border-border bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
    />
  );
}
