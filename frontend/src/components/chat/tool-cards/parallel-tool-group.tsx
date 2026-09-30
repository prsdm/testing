"use client";

import { CheckCheckIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
  getConnectorLabel,
} from "@/components/connectors/connector-provider-icon";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ToolCallAggregateStatus } from "@/shared/chat/parallel-tool-batch";
import { ToolCallLeadingIcon } from "./tool-call-card";
import { ToolStatusIcon } from "./tool-status-icon";

type ParallelToolGroupProps = {
  children: ReactNode;
  toolCount: number;
  aggregateStatus: ToolCallAggregateStatus;
  failedCount?: number;
  autoCollapse?: boolean;
  defaultOpen?: boolean;
  provider?: ConnectorProvider;
};

function GroupStatusIcon({
  aggregateStatus,
}: {
  aggregateStatus: ToolCallAggregateStatus;
}) {
  if (aggregateStatus === "pending") {
    return <ToolStatusIcon status="pending" />;
  }
  if (aggregateStatus === "failed") {
    return <ToolStatusIcon status="failed" />;
  }
  return (
    <CheckCheckIcon
      aria-hidden
      className="size-4 shrink-0 text-emerald-600/80 dark:text-emerald-500/80"
    />
  );
}

function connectorGroupLabel(provider: ConnectorProvider): string {
  return provider === "google-drive" ? "Drive" : getConnectorLabel(provider);
}

function groupHeaderLabel(args: {
  aggregateStatus: ToolCallAggregateStatus;
  toolCount: number;
  provider?: ConnectorProvider;
}): string {
  const stepLabel = `${args.toolCount} ${args.toolCount === 1 ? "step" : "steps"}`;
  if (args.provider) {
    const providerLabel = connectorGroupLabel(args.provider);
    if (args.aggregateStatus === "pending") {
      return `${providerLabel} · Running ${stepLabel}`;
    }
    return `${providerLabel} · ${stepLabel}`;
  }
  const noun = args.toolCount === 1 ? "tool" : "tools";
  if (args.aggregateStatus === "pending") {
    return `Running ${args.toolCount} ${noun}`;
  }
  return `Ran ${args.toolCount} ${noun}`;
}

export function ParallelToolGroup({
  children,
  toolCount,
  aggregateStatus,
  failedCount = 0,
  autoCollapse = false,
  defaultOpen,
  provider,
}: ParallelToolGroupProps) {
  const [isOpen, setIsOpen] = useState(
    defaultOpen ??
      (aggregateStatus === "pending" || aggregateStatus === "failed")
  );
  const didAutoCollapse = useRef(false);

  useEffect(() => {
    if (autoCollapse && !didAutoCollapse.current) {
      didAutoCollapse.current = true;
      setIsOpen(false);
    }
  }, [autoCollapse]);

  return (
    <div className="w-full overflow-hidden rounded-md border border-border/60">
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40"
            type="button"
          >
            <div className="flex min-w-0 w-full items-center gap-2">
              {provider ? (
                <ToolCallLeadingIcon>
                  <ConnectorProviderIcon
                    aria-hidden
                    className="size-4"
                    provider={provider}
                  />
                </ToolCallLeadingIcon>
              ) : null}
              <span className="min-w-0 truncate text-muted-foreground text-sm">
                {groupHeaderLabel({ aggregateStatus, provider, toolCount })}
              </span>
              <GroupStatusIcon aggregateStatus={aggregateStatus} />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {failedCount > 0 ? (
                  <Badge variant="destructive">{failedCount} failed</Badge>
                ) : null}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col border-border/60 border-t divide-y divide-border/60">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
