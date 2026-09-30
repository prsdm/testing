"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import type {
  ModelReasoningPreferences,
  ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import { cn } from "@/shared/utils";
import { ComposerModelPickerItems } from "./composer-model-picker-items";
import { KimiroIconTile } from "./kimiro-icon";

type ComposerModelChipProps = {
  /** Icon-only trigger for compact composer toolbars (e.g. room chat). */
  compact?: boolean;
  disabled?: boolean;
  modelId: string;
  modelReasoningPreferences: ModelReasoningPreferences;
  onModelReasoningPreferenceChange?: (
    modelId: string,
    effort: ReasoningEffortLevel,
    supportsReasoning: boolean
  ) => void;
  onOpenChange?: (open: boolean) => void;
  onSelectModel: (modelId: string) => void;
  open?: boolean;
};

export function ComposerModelChip({
  compact = false,
  disabled,
  modelId,
  modelReasoningPreferences,
  onModelReasoningPreferenceChange,
  onOpenChange,
  onSelectModel,
  open: openProp,
}: ComposerModelChipProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const open = openProp ?? internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setModelMenuOpen(false);
    }
    if (openProp === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center",
        compact ? "max-w-none" : "max-w-[200px]",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <div
          className={cn(
            "inline-flex cursor-pointer items-center text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            compact
              ? "size-8 justify-center rounded-md"
              : "h-8 max-w-[200px] gap-1 rounded-lg px-2",
            open && "bg-muted text-foreground",
            disabled && "cursor-not-allowed"
          )}
        >
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${DEFAULT_COMPOSER_ASSISTANT_SLUG} model`}
              className={cn(
                "inline-flex min-w-0 cursor-pointer items-center text-left disabled:cursor-not-allowed",
                compact ? "justify-center" : "gap-1.5"
              )}
              data-testid="composer-model-chip"
              disabled={disabled}
              type="button"
            >
              <KimiroIconTile size="xs" />
              {compact ? null : (
                <span className="truncate font-medium">
                  {DEFAULT_COMPOSER_ASSISTANT_SLUG}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          align="start"
          className="z-100 min-w-72 rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
          onInteractOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest('[data-slot="popover-content"]')
            ) {
              event.preventDefault();
            }
          }}
          side="top"
          sideOffset={8}
        >
          <Popover onOpenChange={setModelMenuOpen} open={modelMenuOpen}>
            <PopoverAnchor asChild>
              <div className="flex items-center gap-0.5 rounded-lg px-1.5 py-1.5 hover:bg-muted/60">
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-1 py-0.5 text-left"
                  onClick={() => {
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="shrink-0 rounded-lg bg-card">
                    <KimiroIconTile size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground text-sm">
                      {DEFAULT_COMPOSER_ASSISTANT_SLUG}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs">
                      Workspace assistant
                    </span>
                  </span>
                </button>
                <button
                  aria-expanded={modelMenuOpen}
                  aria-label="Choose model for Kimiro"
                  className={cn(
                    "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
                    modelMenuOpen && "bg-background text-foreground"
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setModelMenuOpen((current) => !current);
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  type="button"
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            </PopoverAnchor>
            <PopoverContent
              align="center"
              avoidCollisions={false}
              className="no-scrollbar z-110 max-h-80 w-72 overflow-y-auto rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
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
              <ComposerModelPickerItems
                modelReasoningPreferences={modelReasoningPreferences}
                onModelReasoningPreferenceChange={
                  onModelReasoningPreferenceChange
                }
                onSelect={(nextModelId) => {
                  onSelectModel(nextModelId);
                  setOpen(false);
                }}
                selectedModelId={modelId}
              />
            </PopoverContent>
          </Popover>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
