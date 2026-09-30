"use client";

import { CheckIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import useSWR from "swr";
import { ModelSelectorLogo } from "@/components/ai-elements/model-selector";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { chatModelsApiUrl, fetchChatModels } from "@/lib/ai/chat-models-api";
import {
  type ChatModel,
  chatModels,
  getCapabilities,
  type ModelCapabilities,
} from "@/shared/ai/models";
import {
  type ActiveReasoningEffort,
  defaultReasoningEffortForModel,
  effortLevelsForModel,
  type ModelReasoningPreferences,
  modelSupportsReasoning,
  REASONING_EFFORT_LABELS,
  type ReasoningEffortLevel,
  resolveEffortForModelPreferences,
} from "@/shared/ai/reasoning-effort";
import { cn } from "@/shared/utils";

type ComposerModelPickerItemsProps = {
  /** When set, only these models are listed (e.g. agent settings model). */
  allowedModelIds?: string[] | null;
  modelReasoningPreferences: ModelReasoningPreferences;
  onModelReasoningPreferenceChange?: (
    modelId: string,
    effort: ReasoningEffortLevel,
    supportsReasoning: boolean
  ) => void;
  onSelect: (modelId: string) => void;
  selectedModelId: string | null;
};

function ModelRowLabel({
  effort,
  model,
  supportsReasoning,
}: {
  effort: ReasoningEffortLevel;
  model: ChatModel;
  supportsReasoning: boolean;
}) {
  const showEffort = supportsReasoning && effort !== "off";

  return (
    <span className="truncate">
      {model.name}
      {showEffort ? (
        <span className="ml-1.5 text-muted-foreground!">
          {REASONING_EFFORT_LABELS[effort]}
        </span>
      ) : null}
    </span>
  );
}

function ReasoningModelOptionsPanel({
  activeEffort,
  levels,
  onEffortSelect,
  onThinkingToggle,
  thinkingOn,
}: {
  activeEffort: ActiveReasoningEffort | undefined;
  levels: ActiveReasoningEffort[];
  onEffortSelect: (effort: ActiveReasoningEffort) => void;
  onThinkingToggle: (enabled: boolean) => void;
  thinkingOn: boolean;
}) {
  const highlightedEffort = thinkingOn
    ? (activeEffort ?? defaultReasoningEffortForModel(true))
    : undefined;

  return (
    <>
      <div className="px-2 py-1.5 font-normal text-[11px] text-muted-foreground">
        Options
      </div>
      <div className="flex cursor-default items-center justify-between rounded-md px-2 py-1.5">
        <span className="text-sm">Thinking</span>
        <Switch
          checked={thinkingOn}
          className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-500"
          onCheckedChange={onThinkingToggle}
          size="sm"
        />
      </div>
      <div className="px-2 py-1.5 font-normal text-[11px] text-muted-foreground">
        Effort
      </div>
      {levels.map((level) => {
        const isHighlighted =
          thinkingOn &&
          highlightedEffort !== undefined &&
          highlightedEffort === level;

        return (
          <button
            className={cn(
              "flex w-full cursor-default items-center justify-between rounded-md px-2 py-1.5 text-left text-sm outline-hidden transition-colors hover:bg-accent focus:bg-accent",
              !thinkingOn && "text-muted-foreground"
            )}
            key={level}
            onClick={() => {
              onEffortSelect(level);
            }}
            type="button"
          >
            <span>{REASONING_EFFORT_LABELS[level]}</span>
            {isHighlighted ? (
              <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <span aria-hidden className="size-3.5 shrink-0" />
            )}
          </button>
        );
      })}
    </>
  );
}

function ModelPickerRow({
  children,
  className,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (onClick && !disabled) {
    return (
      <button
        className={cn(
          "relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-hidden transition-colors hover:bg-accent focus:bg-accent",
          className
        )}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-hidden",
        disabled && "cursor-default opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ComposerModelPickerItems({
  allowedModelIds = null,
  modelReasoningPreferences,
  onModelReasoningPreferenceChange,
  onSelect,
  selectedModelId,
}: ComposerModelPickerItemsProps) {
  const tenantSlug = useTenantSlug();
  const [query, setQuery] = useState("");
  const [optionsModelId, setOptionsModelId] = useState<string | null>(null);
  const { data: modelsData } = useSWR(
    tenantSlug ? chatModelsApiUrl(tenantSlug) : null,
    () => fetchChatModels(tenantSlug),
    { dedupingInterval: 60_000, revalidateOnFocus: true }
  );

  const capabilities: Record<string, ModelCapabilities> =
    modelsData?.capabilities ?? getCapabilities();
  const isModelsLoaded = modelsData !== undefined;
  const catalogModels: ChatModel[] = isModelsLoaded
    ? (modelsData?.models ?? [])
    : chatModels;

  const activeModels = useMemo(() => {
    if (!allowedModelIds || allowedModelIds.length === 0) {
      return catalogModels;
    }
    const allowed = new Set(allowedModelIds);
    return catalogModels.filter((model) => allowed.has(model.id));
  }, [allowedModelIds, catalogModels]);

  const showSearch = activeModels.length > 3;

  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return activeModels;
    }
    return activeModels.filter(
      (model) =>
        model.name.toLowerCase().includes(normalized) ||
        model.id.toLowerCase().includes(normalized)
    );
  }, [activeModels, query]);

  const effortForModel = (modelId: string, supportsReasoning: boolean) =>
    resolveEffortForModelPreferences(
      modelReasoningPreferences,
      modelId,
      supportsReasoning
    );

  const applyReasoning = (
    modelId: string,
    effort: ReasoningEffortLevel,
    options?: { close?: boolean; selectModel?: boolean }
  ) => {
    const supportsReasoning = modelSupportsReasoning(modelId, capabilities);
    if (options?.selectModel !== false) {
      onSelect(modelId);
    }
    onModelReasoningPreferenceChange?.(modelId, effort, supportsReasoning);
    if (options?.close !== false) {
      setOptionsModelId(null);
    }
  };

  return (
    <>
      {showSearch ? (
        <div className="px-2 pt-2 pb-1">
          <Input
            className="h-8"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            placeholder="Search models..."
            value={query}
          />
        </div>
      ) : null}
      {isModelsLoaded ? null : (
        <ModelPickerRow disabled>Loading models…</ModelPickerRow>
      )}
      {isModelsLoaded && catalogModels.length === 0 ? (
        <ModelPickerRow disabled>
          Ask an admin to configure model providers in Settings → Models.
        </ModelPickerRow>
      ) : null}
      {isModelsLoaded &&
      allowedModelIds &&
      allowedModelIds.length > 0 &&
      activeModels.length === 0 ? (
        <ModelPickerRow disabled>
          The selected model is not available for this organization.
        </ModelPickerRow>
      ) : null}
      {filteredModels.map((model) => {
        const supportsReasoning = modelSupportsReasoning(
          model.id,
          capabilities
        );
        const rowEffort = effortForModel(model.id, supportsReasoning);
        const levels = effortLevelsForModel(model.id, supportsReasoning);
        const isSelected = model.id === selectedModelId;
        const logoProvider = model.id.split("/")[0];
        const isModelLocked = (allowedModelIds?.length ?? 0) > 0;

        if (isModelLocked || !(supportsReasoning && levels.length > 0)) {
          return (
            <ModelPickerRow
              className="gap-2"
              key={model.id}
              onClick={() => {
                onSelect(model.id);
              }}
            >
              <ModelSelectorLogo provider={logoProvider} />
              <span className="min-w-0 flex-1 truncate">
                <ModelRowLabel
                  effort={rowEffort}
                  model={model}
                  supportsReasoning={supportsReasoning}
                />
              </span>
              {isSelected ? (
                <CheckIcon className="size-3.5 shrink-0 text-foreground" />
              ) : null}
            </ModelPickerRow>
          );
        }

        const isOptionsOpen = optionsModelId === model.id;
        const thinkingOn = rowEffort !== "off";
        const activeEffort =
          rowEffort === "off"
            ? undefined
            : (rowEffort as ActiveReasoningEffort);

        return (
          <Popover
            key={model.id}
            onOpenChange={(nextOpen) => {
              setOptionsModelId(nextOpen ? model.id : null);
            }}
            open={isOptionsOpen}
          >
            <PopoverAnchor asChild>
              <div
                className={cn(
                  "group/model-row flex w-full items-stretch rounded-lg hover:bg-accent",
                  isOptionsOpen && "bg-accent"
                )}
              >
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-left text-sm outline-hidden"
                  onClick={() => {
                    onSelect(model.id);
                  }}
                  type="button"
                >
                  <ModelSelectorLogo provider={logoProvider} />
                  <span className="min-w-0 flex-1 truncate">
                    <ModelRowLabel
                      effort={rowEffort}
                      model={model}
                      supportsReasoning={supportsReasoning}
                    />
                  </span>
                </button>
                <span className="mr-3 flex shrink-0 items-center gap-2 self-stretch">
                  <button
                    className={cn(
                      "inline-flex shrink-0 cursor-pointer items-center self-stretch px-1 text-muted-foreground text-xs opacity-0 transition-opacity hover:text-foreground group-hover/model-row:opacity-100 group-focus-within/model-row:opacity-100",
                      isOptionsOpen && "opacity-100"
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOptionsModelId(isOptionsOpen ? null : model.id);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  {isSelected ? (
                    <CheckIcon className="size-3.5 shrink-0 text-foreground" />
                  ) : null}
                </span>
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="center"
              avoidCollisions={false}
              className="z-110 max-h-(--radix-popover-content-available-height) w-44 overflow-y-auto rounded-lg border-0 bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
              }}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              side="right"
              sideOffset={8}
            >
              <ReasoningModelOptionsPanel
                activeEffort={activeEffort}
                levels={levels}
                onEffortSelect={(effort) => {
                  applyReasoning(model.id, effort);
                }}
                onThinkingToggle={(enabled) => {
                  const modelSupports = modelSupportsReasoning(
                    model.id,
                    capabilities
                  );
                  const savedEffort = effortForModel(model.id, modelSupports);
                  if (enabled) {
                    const restoredEffort =
                      savedEffort === "off"
                        ? defaultReasoningEffortForModel(true)
                        : savedEffort;
                    applyReasoning(model.id, restoredEffort, {
                      close: false,
                      selectModel: false,
                    });
                    return;
                  }
                  applyReasoning(model.id, "off", {
                    close: false,
                    selectModel: false,
                  });
                }}
                thinkingOn={thinkingOn}
              />
            </PopoverContent>
          </Popover>
        );
      })}
      {isModelsLoaded && filteredModels.length === 0 ? (
        <>
          <div className="my-1 h-px bg-border" />
          <ModelPickerRow disabled>No models match</ModelPickerRow>
        </>
      ) : null}
    </>
  );
}
