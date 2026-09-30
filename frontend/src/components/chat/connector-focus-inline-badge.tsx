"use client";

import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { WorkSkillIcon } from "@/components/connectors/work-skill-card";
import { McpIcon } from "@/components/icons/mcp-icon";
import {
  CHAT_MENTION_COMPOSER_MIRROR_CLASS,
  CHAT_MENTION_TEXT_CLASS,
} from "@/shared/chat/mention-styles";
import {
  type ComposerConnectorFocus,
  connectorFocusLabel,
} from "@/shared/connectors/composer-connector-focus";
import { cn } from "@/shared/utils";

function ConnectorFocusIconGraphic({
  focus,
}: {
  focus: ComposerConnectorFocus;
}) {
  if (focus.kind === "work-skill") {
    return (
      <WorkSkillIcon
        className="max-h-[1em] max-w-[1em] object-contain"
        skillId={focus.skillId}
      />
    );
  }
  if (focus.kind === "mcp") {
    return <McpIcon className="size-[1em] text-muted-foreground" />;
  }
  return (
    <ConnectorProviderIcon
      className="max-h-[1em] max-w-[1em] object-contain"
      provider={focus.provider}
    />
  );
}

/** Inline connector: icon + label (same accent as @mentions). */
export function ConnectorFocusInlineBadge({
  focus,
  disabled = false,
  className,
  iconClassName,
  variant = "composer",
}: {
  focus: ComposerConnectorFocus;
  /** @deprecated Chips are removed via backspace; kept for test ids only. */
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
  /** Composer matches {@link CHAT_MENTION_COMPOSER_MIRROR_CLASS}; sent messages use semibold. */
  variant?: "composer" | "message";
}) {
  const label = connectorFocusLabel(focus);
  const labelClass =
    variant === "message"
      ? CHAT_MENTION_TEXT_CLASS
      : CHAT_MENTION_COMPOSER_MIRROR_CLASS;

  return (
    <span
      className={cn(
        "inline max-w-full align-baseline text-base leading-6",
        variant === "message" && "truncate",
        labelClass,
        disabled && "opacity-60",
        className
      )}
      data-testid={
        variant === "composer"
          ? "composer-connector-chip"
          : "message-connector-badge"
      }
    >
      <span
        className={cn(
          "relative inline-block h-lh align-baseline pr-1 leading-lh",
          iconClassName
        )}
      >
        <span
          aria-hidden
          className="block h-lh w-[1em] text-[1em] leading-lh text-transparent"
        >
          {"\u2007"}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 flex h-lh w-[1em] items-center justify-center"
        >
          <ConnectorFocusIconGraphic focus={focus} />
        </span>
      </span>
      {label}
    </span>
  );
}
