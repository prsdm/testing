"use client";

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { SettingsRequiredMark } from "@/components/admin/required-mark";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/shared/utils";

export function SettingsCard({
  title,
  description,
  action,
  banner,
  children,
  footer,
  required = false,
  collapsible = false,
  defaultOpen = true,
}: {
  title: ReactNode;
  description?: string;
  action?: ReactNode;
  banner?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  required?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const titleBlock = (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 className="font-medium text-sm">
        {title}
        {required ? (
          <>
            {" "}
            <SettingsRequiredMark />
          </>
        ) : null}
      </h2>
      {description ? (
        <p className="text-[13px] text-muted-foreground leading-snug">
          {description}
        </p>
      ) : null}
    </div>
  );

  const actionSlot = action ? (
    <div className="shrink-0 [&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed **:data-[slot=dropdown-menu-item]:cursor-pointer **:data-[slot=dropdown-menu-radio-item]:cursor-pointer">
      {action}
    </div>
  ) : null;

  const chevronTrigger = collapsible ? (
    <CollapsibleTrigger asChild>
      <button
        aria-label={open ? "Collapse section" : "Expand section"}
        className="inline-flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        type="button"
      >
        <ChevronRightIcon
          className={cn(
            "size-4 transition-transform duration-200",
            open && "rotate-90"
          )}
        />
      </button>
    </CollapsibleTrigger>
  ) : null;

  const headerRow = (
    <div className="flex items-center justify-between gap-4">
      {titleBlock}
      <div className="flex shrink-0 items-center gap-2">
        {actionSlot}
        {collapsible ? chevronTrigger : null}
      </div>
    </div>
  );

  const body = (
    <>
      {children}
      {footer}
    </>
  );

  if (!collapsible) {
    return (
      <section className="rounded-lg border border-border/60 p-4">
        {banner}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            {titleBlock}
            {actionSlot}
          </div>
          {body}
        </div>
      </section>
    );
  }

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <section className="rounded-lg border border-border/60 p-4">
        {banner}
        <div className="flex flex-col">
          {headerRow}
          <CollapsibleContent>
            <div className="flex flex-col gap-4 pt-4">{body}</div>
          </CollapsibleContent>
        </div>
      </section>
    </Collapsible>
  );
}
