"use client";

import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import {
  type ConnectionActionResultItem,
  type ConnectionActionToolOutput,
  type ConnectorActionToolType,
  connectorToolCallHasExpandableBody,
  getConnectionActionResultItems,
  getConnectionActionToolMeta,
  getConnectorToolCallHeader,
  getConnectorToolDeniedReason,
  isConnectionActionToolPending,
  isConnectorToolExecutionDenied,
  type SlackUserLookup,
  sanitizeConnectorToolInputForDisplay,
  sanitizeConnectorToolOutputForDisplay,
} from "@/shared/chat/connector-action-tools";
import { isInterruptedToolForDisplay } from "@/shared/chat/tool-part-pending";
import { isConnectorAuthErrorMessage } from "@/shared/connectors/connect-on-auth-error";
import { ConnectorConnectButton } from "../connector-connect-button";
import { ToolCallCard } from "./tool-call-card";
import { ToolCardSection, ToolCardSurface } from "./tool-card-surface";
import { ToolJsonSection } from "./tool-json-section";
import type { ToolCallStatus } from "./tool-status-icon";

function ResultLink({
  item,
  provider,
}: {
  item: ConnectionActionResultItem;
  provider: ReturnType<typeof getConnectionActionToolMeta>["provider"];
}) {
  const label = (
    <>
      <ConnectorProviderIcon
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground"
        provider={provider}
      />
      <span className="truncate">{item.label}</span>
    </>
  );

  if (item.link) {
    return (
      <a
        className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-sm transition-colors hover:bg-muted/50"
        href={item.link}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
      </a>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-sm">
      {label}
    </span>
  );
}

function ConnectorToolError({
  output,
  provider,
}: {
  output: ConnectionActionToolOutput;
  provider: ReturnType<typeof getConnectionActionToolMeta>["provider"];
}) {
  const showConnectLink =
    Boolean(output.connectUrl) &&
    typeof output.error === "string" &&
    isConnectorAuthErrorMessage(output.error);

  return (
    <ToolCardSection tinted>
      <p className="text-muted-foreground text-sm">{output.error}</p>
      {showConnectLink && output.connectUrl ? (
        <ConnectorConnectButton
          className="mt-2"
          href={output.connectUrl}
          label={output.connectLabel ?? "Connect account"}
          provider={provider}
        />
      ) : null}
    </ToolCardSection>
  );
}

export function ConnectorToolCard({
  toolType,
  input,
  output,
  state,
  nested = false,
  slackUserLookup,
  isMessageStreaming = true,
}: {
  toolType: ConnectorActionToolType;
  input?: unknown;
  output?: ConnectionActionToolOutput;
  state: string;
  nested?: boolean;
  slackUserLookup?: SlackUserLookup;
  isMessageStreaming?: boolean;
}) {
  const meta = getConnectionActionToolMeta(toolType);
  const denied =
    state === "output-denied" || isConnectorToolExecutionDenied(output);
  const isInterrupted = isInterruptedToolForDisplay({
    hasOutput: output !== undefined,
    isMessageStreaming,
    state,
  });
  const isPending =
    !isInterrupted &&
    isMessageStreaming &&
    (isConnectionActionToolPending({ state, type: toolType }) ||
      ((state === "approval-responded" || state === "output-available") &&
        output === undefined));
  const failed = !denied && Boolean(output?.error);
  const headerParts = getConnectorToolCallHeader({
    denied,
    input,
    interrupted: isInterrupted,
    isPending,
    output,
    slackUserLookup,
    toolType,
  });
  const displayInput = sanitizeConnectorToolInputForDisplay(input, {
    slackUserLookup,
    toolType,
  });

  const status: ToolCallStatus = isPending
    ? "pending"
    : isInterrupted
      ? "interrupted"
      : denied
        ? "denied"
        : failed
          ? "failed"
          : "completed";

  const sanitizedOutput = sanitizeConnectorToolOutputForDisplay(output, {
    toolType,
  });
  const hasOutput = Boolean(
    !isPending &&
      !failed &&
      sanitizedOutput &&
      typeof sanitizedOutput === "object" &&
      Object.keys(sanitizedOutput as object).length > 0
  );
  const resultItems = output
    ? getConnectionActionResultItems(toolType, output)
    : [];
  const hasBody =
    !isInterrupted &&
    connectorToolCallHasExpandableBody({
      denied,
      input,
      isPending,
      output,
      toolType,
    });

  const resultFooter =
    !failed && !denied && !isPending && resultItems.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {resultItems.map((item) => (
          <ResultLink item={item} key={item.key} provider={meta.provider} />
        ))}
      </div>
    ) : null;

  const deniedReason = denied
    ? getConnectorToolDeniedReason(output)
    : undefined;

  return (
    <ToolCallCard
      defaultOpen={failed}
      dense={nested}
      expandable={hasBody}
      failed={failed}
      footer={denied && deniedReason ? deniedReason : undefined}
      label={headerParts.verb}
      leadingIcon={
        <ConnectorProviderIcon className="size-4" provider={meta.provider} />
      }
      nested={nested}
      status={status}
    >
      {hasBody ? (
        <ToolCardSurface>
          {denied && input !== undefined ? (
            <ToolCardSection>
              <ToolJsonSection value={displayInput} />
            </ToolCardSection>
          ) : null}
          {failed && output ? (
            <ToolCardSection divider={denied && input !== undefined}>
              <ConnectorToolError output={output} provider={meta.provider} />
            </ToolCardSection>
          ) : null}
          {!denied && !failed ? (
            <>
              {hasOutput ? (
                <ToolCardSection>
                  <ToolJsonSection value={sanitizedOutput} />
                </ToolCardSection>
              ) : null}
              {resultFooter ? (
                <ToolCardSection divider={hasOutput} tinted={hasOutput}>
                  {resultFooter}
                </ToolCardSection>
              ) : null}
            </>
          ) : null}
        </ToolCardSurface>
      ) : null}
    </ToolCallCard>
  );
}
