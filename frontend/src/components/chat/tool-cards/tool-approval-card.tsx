"use client";

import { ChevronDownIcon, CircleHelpIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import {
  ConnectorProviderIcon,
  getConnectorLabel,
} from "@/components/connectors/connector-provider-icon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  getConnectionActionToolMeta,
  isConnectorActionToolType,
  type SlackUserLookup,
  sanitizeConnectorToolInputForDisplay,
} from "@/shared/chat/connector-action-tools";
import {
  getToolApprovalHeadline,
  getToolApprovalWarning,
  latestUserMessageTextFromChat,
} from "@/shared/chat/tool-approval-display";
import { cn } from "@/shared/utils";
import { ToolCardSection, ToolCardSurface } from "./tool-card-surface";
import { ToolJsonSection } from "./tool-json-section";

type ToolApprovalCardProps = {
  toolName: string;
  args?: Record<string, unknown>;
  busy?: boolean;
  error?: string | null;
  onApprove: () => void;
  onReject: () => void;
  slackUserLookup?: SlackUserLookup;
};

/** Onyx-style inline tool approval card for suspended workflow runs. */
export function ToolApprovalCard({
  toolName,
  args,
  busy = false,
  error,
  onApprove,
  onReject,
  slackUserLookup,
}: ToolApprovalCardProps) {
  const [open, setOpen] = useState(false);
  const { messages } = useActiveChat();
  const userMessageText = latestUserMessageTextFromChat(messages);
  const headline = getToolApprovalHeadline(toolName, args, slackUserLookup);
  const approvalWarning = getToolApprovalWarning(
    toolName,
    args,
    userMessageText
  );
  const normalizedToolType = toolName.startsWith("tool-")
    ? toolName
    : `tool-${toolName}`;
  const connectorToolType = isConnectorActionToolType(normalizedToolType)
    ? normalizedToolType
    : undefined;
  const displayArgs = connectorToolType
    ? (sanitizeConnectorToolInputForDisplay(args, {
        slackUserLookup,
        toolType: connectorToolType,
      }) as Record<string, unknown> | undefined)
    : args;
  const hasPayload = Boolean(
    displayArgs && Object.keys(displayArgs).length > 0
  );
  const connectorMeta = connectorToolType
    ? getConnectionActionToolMeta(connectorToolType)
    : null;
  const providerLabel = connectorMeta
    ? connectorMeta.provider === "google-drive"
      ? "Drive"
      : getConnectorLabel(connectorMeta.provider)
    : null;

  return (
    <div className="w-full overflow-hidden rounded-md border border-border/60 bg-background shadow-xs">
      <Collapsible onOpenChange={setOpen} open={open}>
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          {busy ? (
            <Loader2Icon
              aria-hidden
              className="size-4 shrink-0 animate-spin text-muted-foreground"
            />
          ) : (
            <CircleHelpIcon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground text-sm">
              Approval required
            </p>
            <p className="truncate text-muted-foreground text-sm">{headline}</p>
            {approvalWarning ? (
              <p className="mt-1 text-amber-700 text-xs dark:text-amber-300">
                {approvalWarning}
              </p>
            ) : null}
          </div>
          {connectorMeta && providerLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-sm">
              <ConnectorProviderIcon
                className="size-3 shrink-0"
                provider={connectorMeta.provider}
              />
              {providerLabel}
            </span>
          ) : null}
          {hasPayload ? (
            <CollapsibleTrigger asChild>
              <button
                aria-label={open ? "Hide details" : "Show details"}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40"
                type="button"
              >
                <ChevronDownIcon
                  className={cn(
                    "size-4 transition-transform duration-150",
                    !open && "-rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          ) : null}
        </div>

        {hasPayload ? (
          <CollapsibleContent>
            <div className="border-border/50 border-t px-2 py-2">
              <ToolCardSurface>
                <ToolCardSection>
                  <ToolJsonSection value={displayArgs} />
                </ToolCardSection>
              </ToolCardSurface>
            </div>
          </CollapsibleContent>
        ) : null}

        <div className="flex flex-wrap items-center justify-start gap-1.5 border-border/50 border-t bg-muted/15 px-3 py-2">
          <Button
            className="h-8 rounded-lg"
            disabled={busy}
            onClick={onReject}
            size="sm"
            type="button"
            variant="ghost"
          >
            Reject
          </Button>
          <Button
            className="h-8 rounded-lg"
            disabled={busy}
            onClick={onApprove}
            size="sm"
            type="button"
          >
            Approve
          </Button>
        </div>
      </Collapsible>

      {error ? (
        <p className="px-3 pb-2 text-destructive text-sm">{error}</p>
      ) : null}
    </div>
  );
}
