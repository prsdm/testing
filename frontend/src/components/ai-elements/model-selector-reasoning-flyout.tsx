"use client";

import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorPill,
} from "@/components/ai-elements/model-selector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { ChatModel, ModelCapabilities } from "@/shared/ai/models";
import {
  type ActiveReasoningEffort,
  defaultReasoningEffortForModel,
  effortLevelsForModel,
  formatModelSelectorLabel,
  type ModelReasoningPreferences,
  modelSupportsReasoning,
  normalizeReasoningEffortForModel,
  REASONING_EFFORT_LABELS,
  type ReasoningEffortLevel,
  resolveEffortForModelPreferences,
} from "@/shared/ai/reasoning-effort";
import { cn } from "@/shared/utils";

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

export function ModelSelectorReasoningFlyout({
  activeModels,
  capabilities,
  disabled = false,
  fallbackOption,
  focusOnClose = true,
  isModelsLoaded,
  menuSide = "top",
  modelReasoningPreferences,
  onFallbackSelect,
  onModelChange,
  onModelReasoningPreferenceChange,
  persistChatModelCookie = true,
  reasoningEffort,
  selectedModelId,
  setCookie,
  triggerClassName,
  triggerAppearance = "ghost",
  triggerName,
}: {
  activeModels: ChatModel[];
  capabilities: Record<string, ModelCapabilities>;
  disabled?: boolean;
  fallbackOption?: {
    label: string;
  };
  focusOnClose?: boolean;
  isModelsLoaded: boolean;
  menuSide?: "bottom" | "left" | "right" | "top";
  modelReasoningPreferences: ModelReasoningPreferences;
  onFallbackSelect?: () => void;
  onModelChange?: (modelId: string) => void;
  onModelReasoningPreferenceChange?: (
    modelId: string,
    effort: ReasoningEffortLevel,
    supportsReasoning: boolean
  ) => void;
  persistChatModelCookie?: boolean;
  reasoningEffort: ReasoningEffortLevel;
  selectedModelId: string | null;
  setCookie: (name: string, value: string) => void;
  triggerAppearance?: "outline" | "ghost";
  triggerClassName?: string;
  triggerName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [optionsModelId, setOptionsModelId] = useState<string | null>(null);
  const [openAnchor, setOpenAnchor] = useState<{
    label: string;
    width: number;
  } | null>(null);

  const selectedModel = selectedModelId
    ? (activeModels.find((model) => model.id === selectedModelId) ?? null)
    : null;
  const usingFallback = selectedModelId === null && Boolean(fallbackOption);
  const isResolvingSelection =
    Boolean(selectedModelId) && !selectedModel && !isModelsLoaded;

  const selectedSupportsReasoning = selectedModel
    ? modelSupportsReasoning(selectedModel.id, capabilities)
    : false;

  const normalizedEffort = selectedModel
    ? normalizeReasoningEffortForModel({
        effort: reasoningEffort,
        modelId: selectedModel.id,
        supportsReasoning: selectedSupportsReasoning,
      })
    : "off";

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return activeModels;
    }
    return activeModels.filter((model) =>
      model.name.toLowerCase().includes(normalizedQuery)
    );
  }, [activeModels, query]);

  const showFallbackOption =
    fallbackOption &&
    (!query.trim() ||
      fallbackOption.label.toLowerCase().includes(query.trim().toLowerCase()));

  if (!selectedModel && !usingFallback && !isResolvingSelection) {
    return null;
  }

  const provider = selectedModel?.id.split("/")[0];
  const pillLabel = selectedModel
    ? formatModelSelectorLabel(
        selectedModel.name,
        normalizedEffort,
        selectedSupportsReasoning
      )
    : isResolvingSelection
      ? (triggerName ?? "Loading models…")
      : (fallbackOption?.label ?? "");
  const resolvedTriggerName = triggerName ?? pillLabel;
  const triggerLabel =
    open && openAnchor?.label ? openAnchor.label : resolvedTriggerName;
  const triggerStyle =
    open && openAnchor ? { width: openAnchor.width } : undefined;

  const captureOpenAnchor = () => {
    const width =
      document
        .querySelector<HTMLElement>("[data-testid='model-selector']")
        ?.getBoundingClientRect().width ?? 0;

    setOpenAnchor({
      label: resolvedTriggerName,
      width,
    });
  };

  const closeAndFocus = () => {
    setOpen(false);
    setOpenAnchor(null);
    setOptionsModelId(null);
    setQuery("");
    if (!focusOnClose) {
      return;
    }
    setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>("[data-testid='multimodal-input']")
        ?.focus();
    }, 50);
  };

  const selectModel = (modelId: string) => {
    onModelChange?.(modelId);
    if (persistChatModelCookie) {
      setCookie("chat-model", modelId);
    }
  };

  const handleModelSelect = (modelId: string) => {
    selectModel(modelId);
    closeAndFocus();
  };

  const handleFallbackSelect = () => {
    onFallbackSelect?.();
    closeAndFocus();
  };

  const effortForModel = (modelId: string, supportsReasoning: boolean) =>
    resolveEffortForModelPreferences(
      modelReasoningPreferences,
      modelId,
      supportsReasoning
    );

  const applyReasoningForModel = (
    modelId: string,
    effort: ReasoningEffortLevel,
    options?: { close?: boolean; selectModel?: boolean }
  ) => {
    const supportsReasoning = modelSupportsReasoning(modelId, capabilities);

    if (options?.selectModel !== false && modelId !== selectedModelId) {
      selectModel(modelId);
    }

    onModelReasoningPreferenceChange?.(modelId, effort, supportsReasoning);

    if (options?.close !== false) {
      closeAndFocus();
    }
  };

  const handleReasoningEffortSelect = (
    modelId: string,
    effort: ActiveReasoningEffort
  ) => {
    applyReasoningForModel(modelId, effort);
  };

  const handleThinkingToggle = (modelId: string, enabled: boolean) => {
    const supportsReasoning = modelSupportsReasoning(modelId, capabilities);
    const savedEffort = effortForModel(modelId, supportsReasoning);

    if (enabled) {
      const restoredEffort =
        savedEffort === "off"
          ? defaultReasoningEffortForModel(true)
          : savedEffort;
      applyReasoningForModel(modelId, restoredEffort, {
        close: false,
        selectModel: false,
      });
      return;
    }

    applyReasoningForModel(modelId, "off", {
      close: false,
      selectModel: false,
    });
  };

  const isThinkingOnForModel = (modelId: string) => {
    const supportsReasoning = modelSupportsReasoning(modelId, capabilities);
    return effortForModel(modelId, supportsReasoning) !== "off";
  };

  const highlightedEffortForModel = (
    modelId: string
  ): ActiveReasoningEffort | undefined => {
    const supportsReasoning = modelSupportsReasoning(modelId, capabilities);
    const effort = effortForModel(modelId, supportsReasoning);
    return effort === "off" ? undefined : effort;
  };

  return (
    <DropdownMenu
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          captureOpenAnchor();
        } else {
          setOpenAnchor(null);
          setOptionsModelId(null);
          setQuery("");
        }
        setOpen(nextOpen);
      }}
      open={disabled ? false : open}
    >
      <DropdownMenuTrigger asChild>
        <ModelSelectorPill
          appearance={triggerAppearance}
          chevronDirection={menuSide === "top" ? "up" : "down"}
          className={cn(
            "max-w-60 shrink-0 px-2",
            disabled &&
              "cursor-not-allowed opacity-80 hover:bg-transparent hover:text-muted-foreground",
            triggerClassName
          )}
          data-testid="model-selector"
          disabled={disabled}
          logoClassName="size-4 shrink-0"
          name={triggerLabel}
          provider={provider}
          showChevron={!disabled}
          style={triggerStyle}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="no-scrollbar w-72"
        onInteractOutside={(event) => {
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest('[data-slot="popover-content"]')
          ) {
            event.preventDefault();
          }
        }}
        side={menuSide}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: stops menu keyboard handling while typing */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: input wrapper intentionally intercepts bubbling */}
        <div
          className="px-2 pt-2 pb-1"
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <Input
            className="h-8"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search models..."
            value={query}
          />
        </div>
        <DropdownMenuGroup>
          {isModelsLoaded ? null : (
            <DropdownMenuItem disabled>Loading models…</DropdownMenuItem>
          )}
          {isModelsLoaded && activeModels.length === 0 && !fallbackOption ? (
            <DropdownMenuItem disabled>
              Ask an admin to configure model providers in Settings → Models.
            </DropdownMenuItem>
          ) : null}
          {showFallbackOption ? (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                handleFallbackSelect();
              }}
            >
              <ModelSelectorName>{fallbackOption.label}</ModelSelectorName>
              {selectedModelId === null ? (
                <CheckIcon className="ml-auto size-3.5 shrink-0 text-foreground" />
              ) : null}
            </DropdownMenuItem>
          ) : null}
          {filteredModels.map((model) => {
            const supportsReasoning = modelSupportsReasoning(
              model.id,
              capabilities
            );
            const isSelected = model.id === selectedModelId;
            const rowEffort = effortForModel(model.id, supportsReasoning);
            const levels = effortLevelsForModel(model.id, supportsReasoning);
            const logoProvider = model.id.split("/")[0];

            if (supportsReasoning && levels.length > 0) {
              const isOptionsOpen = optionsModelId === model.id;

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
                      <DropdownMenuItem
                        className="min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-none pr-1 focus:bg-transparent"
                        onSelect={() => {
                          handleModelSelect(model.id);
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
                      </DropdownMenuItem>
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
                    className="z-60 max-h-(--radix-popover-content-available-height) w-44 overflow-y-auto rounded-lg border-0 bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5"
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
                      activeEffort={highlightedEffortForModel(model.id)}
                      levels={levels}
                      onEffortSelect={(effort) => {
                        handleReasoningEffortSelect(model.id, effort);
                      }}
                      onThinkingToggle={(enabled) => {
                        handleThinkingToggle(model.id, enabled);
                      }}
                      thinkingOn={isThinkingOnForModel(model.id)}
                    />
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <DropdownMenuItem
                className="cursor-pointer"
                key={model.id}
                onSelect={() => {
                  handleModelSelect(model.id);
                }}
              >
                <ModelSelectorLogo provider={logoProvider} />
                <ModelSelectorName>{model.name}</ModelSelectorName>
                {isSelected ? (
                  <CheckIcon className="ml-auto size-3.5 shrink-0 text-foreground" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
          {isModelsLoaded && filteredModels.length === 0 ? (
            <DropdownMenuItem disabled>No models found.</DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
