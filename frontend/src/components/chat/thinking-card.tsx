"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { ChevronRightIcon, MessageSquareTextIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { normalizeThinkingText } from "@/shared/chat/thinking-text";
import { cn } from "@/shared/utils";
import { Shimmer } from "../ai-elements/shimmer";
import { ToolCallLeadingIcon } from "./tool-cards/tool-call-card";

const streamdownPlugins = { cjk, code, math, mermaid };

function ThinkingActivityIcon({ isStreaming }: { isStreaming: boolean }) {
  if (!isStreaming) {
    return (
      <ToolCallLeadingIcon>
        <MessageSquareTextIcon aria-hidden />
      </ToolCallLeadingIcon>
    );
  }

  return (
    <ToolCallLeadingIcon>
      <span
        aria-hidden
        className="relative flex size-4 items-center justify-center"
      >
        <span className="absolute size-3 rounded-full bg-sky-500/25 motion-safe:animate-ping motion-reduce:hidden" />
        <span className="size-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
      </span>
    </ToolCallLeadingIcon>
  );
}

type ThinkingCardProps = {
  content: string;
  isStreaming: boolean;
  defaultOpen?: boolean;
};

/** Craft-style collapsible thinking row for inline agent stream. */
export function ThinkingCard({
  content,
  isStreaming,
  defaultOpen = false,
}: ThinkingCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trimmed = content.trim();
  const expandable = trimmed.length > 0;

  useLayoutEffect(() => {
    if (isStreaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const label = isStreaming ? (
    <Shimmer as="span" duration={1}>
      Thinking
    </Shimmer>
  ) : (
    "Thought"
  );

  const header = (
    <div className="flex min-w-0 w-full items-center gap-2">
      <ThinkingActivityIcon isStreaming={isStreaming} />
      <span className="min-w-0 truncate text-muted-foreground text-sm">
        {label}
      </span>
      <span aria-hidden className="size-4 shrink-0" />
      <ChevronRightIcon
        aria-hidden={!expandable}
        className={cn(
          "ml-auto size-4 shrink-0 text-muted-foreground/70",
          !expandable && "invisible"
        )}
      />
    </div>
  );

  if (!expandable) {
    return (
      <div
        className="w-full overflow-hidden rounded-md border border-border/60"
        data-testid="message-reasoning"
      >
        <div className="px-3 py-1.5">{header}</div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-border/60">
      <Collapsible
        data-testid="message-reasoning"
        onOpenChange={setOpen}
        open={open}
      >
        <CollapsibleTrigger asChild>
          <button
            className="w-full rounded-md px-3 py-1.5 text-left transition-colors hover:bg-muted/40"
            type="button"
          >
            {header}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className="max-h-48 overflow-y-auto border-border/60 border-t px-3 pb-2 pt-2 [scrollbar-width:none]"
            ref={scrollRef}
          >
            <div className="text-muted-foreground text-sm leading-relaxed [&_li]:my-0.5 [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1">
              <Streamdown plugins={streamdownPlugins}>
                {normalizeThinkingText(trimmed)}
              </Streamdown>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
