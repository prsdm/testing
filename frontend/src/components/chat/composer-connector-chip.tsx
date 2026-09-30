"use client";

import { XIcon } from "lucide-react";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { WorkSkillIcon } from "@/components/connectors/work-skill-card";
import { McpIcon } from "@/components/icons/mcp-icon";
import {
  type ComposerConnectorFocus,
  connectorFocusLabel,
} from "@/shared/connectors/composer-connector-focus";
import { cn } from "@/shared/utils";

export function ComposerConnectorChip({
  focus,
  disabled = false,
  onClear,
}: {
  focus: ComposerConnectorFocus;
  disabled?: boolean;
  onClear: () => void;
}) {
  const label = connectorFocusLabel(focus);

  return (
    <div
      className={cn(
        "inline-flex h-8 max-w-[min(100%,240px)] items-center gap-1.5 rounded-lg bg-muted/80 pl-2 pr-1 font-medium text-foreground text-sm",
        disabled && "pointer-events-none opacity-60"
      )}
      data-testid="composer-connector-chip"
    >
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">
        {focus.kind === "work-skill" ? (
          <WorkSkillIcon className="size-4" compact skillId={focus.skillId} />
        ) : focus.kind === "mcp" ? (
          <McpIcon className="size-4 text-muted-foreground" />
        ) : focus.kind === "google-app" ? (
          <ConnectorProviderIcon
            className="size-4 shrink-0 object-contain"
            provider={focus.provider}
          />
        ) : (
          <ConnectorProviderIcon
            className="size-4 shrink-0 object-contain"
            provider={focus.provider}
          />
        )}
      </span>
      <span className="truncate">{label}</span>
      <button
        aria-label={`Remove ${label} from chat`}
        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClear();
        }}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}
