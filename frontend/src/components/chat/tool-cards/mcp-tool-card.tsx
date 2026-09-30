"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { McpIcon } from "@/components/icons/mcp-icon";
import {
  formatMcpToolCardLabel,
  getMcpToolDisplayMeta,
  sanitizeMcpToolOutputForDisplay,
} from "@/shared/chat/mcp-action-tools";
import { isInterruptedToolForDisplay } from "@/shared/chat/tool-part-pending";
import { ToolCallCard, ToolCallLeadingIcon } from "./tool-call-card";
import { ToolCardSection, ToolCardSurface } from "./tool-card-surface";
import { ToolJsonSection } from "./tool-json-section";
import type { ToolCallStatus } from "./tool-status-icon";

export function McpToolCard({
  toolType,
  input,
  output,
  state,
  errorText,
  nested = false,
  isMessageStreaming = true,
}: {
  toolType: string;
  input?: unknown;
  output?: unknown;
  state: string;
  errorText?: string;
  nested?: boolean;
  isMessageStreaming?: boolean;
}) {
  const { serverLabel, toolLabel } = getMcpToolDisplayMeta(toolType);
  const isInterrupted = isInterruptedToolForDisplay({
    hasOutput: output !== undefined,
    isMessageStreaming,
    state,
  });
  const isPending =
    !isInterrupted &&
    isMessageStreaming &&
    (state === "input-streaming" ||
      state === "input-available" ||
      ((state === "approval-responded" || state === "output-available") &&
        output === undefined));
  const outputRecord =
    output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : null;
  const errorMessage =
    (typeof errorText === "string" && errorText.trim()) ||
    (typeof outputRecord?.error === "string" ? outputRecord.error : undefined);
  const failed = Boolean(errorMessage);
  const status: ToolCallStatus = isPending
    ? "pending"
    : isInterrupted
      ? "interrupted"
      : failed
        ? "failed"
        : "completed";

  const displayOutput = sanitizeMcpToolOutputForDisplay(output);
  const hasJsonBody = (value: unknown) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as object).length > 0;
    }
    return true;
  };
  const hasInput = hasJsonBody(input);
  const hasOutputBody = !isPending && !failed && hasJsonBody(displayOutput);
  const hasBody = !isInterrupted && (hasInput || hasOutputBody || failed);

  const labelText = formatMcpToolCardLabel({ serverLabel, toolLabel });
  const label = isPending ? (
    <Shimmer as="span" duration={1}>
      {labelText}
    </Shimmer>
  ) : (
    labelText
  );

  return (
    <ToolCallCard
      defaultOpen={failed}
      dense={nested}
      expandable={hasBody}
      failed={failed}
      label={label}
      leadingIcon={
        <ToolCallLeadingIcon>
          <McpIcon className="size-4" />
        </ToolCallLeadingIcon>
      }
      nested={nested}
      status={status}
    >
      {hasBody ? (
        <ToolCardSurface>
          {hasInput ? (
            <ToolCardSection>
              <ToolJsonSection value={input} />
            </ToolCardSection>
          ) : null}
          {failed ? (
            <ToolCardSection divider={hasInput}>
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
            </ToolCardSection>
          ) : hasOutputBody ? (
            <ToolCardSection divider={hasInput}>
              <ToolJsonSection value={displayOutput} />
            </ToolCardSection>
          ) : null}
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}
