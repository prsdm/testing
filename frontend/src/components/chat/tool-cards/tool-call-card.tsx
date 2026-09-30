"use client";

import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/shared/utils";
import { type ToolCallStatus, ToolStatusIcon } from "./tool-status-icon";

type ToolCallCardProps = {
  status: ToolCallStatus;
  label: ReactNode;
  leadingIcon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  expandable?: boolean;
  defaultOpen?: boolean;
  failed?: boolean;
  dense?: boolean;
  nested?: boolean;
};

export function ToolCallLeadingIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ToolCallCard({
  status,
  label,
  leadingIcon,
  children,
  footer,
  expandable = Boolean(children),
  defaultOpen,
  failed = false,
  dense = false,
  nested = false,
}: ToolCallCardProps) {
  const [open, setOpen] = useState(defaultOpen ?? failed);
  const canExpand = expandable && Boolean(children);

  const headerRow = (
    <div className="flex min-w-0 w-full items-center gap-2">
      {leadingIcon ? (
        <ToolCallLeadingIcon>{leadingIcon}</ToolCallLeadingIcon>
      ) : null}
      <span className="min-w-0 truncate text-muted-foreground text-sm">
        {label}
      </span>
      <ToolStatusIcon status={status} />
      <ChevronRightIcon
        aria-hidden={!canExpand}
        className={cn(
          "ml-auto size-4 shrink-0 text-muted-foreground/70",
          !canExpand && "invisible"
        )}
      />
    </div>
  );

  const footerRow = footer ? (
    <div
      className={cn(
        "border-border/60 border-t px-3 pb-2 pt-1.5 text-muted-foreground text-xs",
        dense && "pb-1.5"
      )}
    >
      {footer}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "w-full",
        !nested && "overflow-hidden rounded-md border border-border/60"
      )}
    >
      {canExpand ? (
        <Collapsible onOpenChange={setOpen} open={open}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "w-full rounded-md px-3 text-left transition-colors hover:bg-muted/40",
                dense ? "py-1.5" : "py-2"
              )}
              type="button"
            >
              {headerRow}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>{children}</CollapsibleContent>
        </Collapsible>
      ) : (
        <div className={cn("px-3", dense ? "py-1.5" : "py-2")}>{headerRow}</div>
      )}
      {footerRow}
    </div>
  );
}
