"use client";

import { useEffect, useRef } from "react";
import { KimiroIconTile } from "@/components/chat/kimiro-icon";
import type { RoomMentionTarget } from "@/lib/chat/room-mention-autocomplete";
import { cn } from "@/shared/utils";

type RoomMentionMenuProps = {
  targets: RoomMentionTarget[];
  selectedIndex: number;
  onSelect: (target: RoomMentionTarget) => void;
};

export function RoomMentionMenu({
  targets,
  selectedIndex,
  onSelect,
}: RoomMentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll selected row into view when index changes
  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-(--shadow-float) backdrop-blur-xl"
      ref={menuRef}
    >
      <div className="px-4 py-2.5 font-medium text-muted-foreground/40 text-xs uppercase tracking-wider">
        Mention
      </div>
      <div className="max-h-64 overflow-y-auto pb-1 no-scrollbar">
        {targets.map((target, index) => (
          <button
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
              index === selectedIndex ? "bg-muted/70" : "hover:bg-muted/40"
            )}
            data-selected={index === selectedIndex}
            key={
              target.kind === "agent"
                ? "agent-kimiro"
                : `member-${target.userId}`
            }
            onClick={() => onSelect(target)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            {target.kind === "agent" ? (
              <KimiroIconTile className="shrink-0" size="sm" />
            ) : (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground text-xs">
                {target.label.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">
                  {target.label}
                </span>
                {target.kind === "agent" ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                    Agent
                  </span>
                ) : target.isSelf ? (
                  <span className="text-muted-foreground text-xs">(you)</span>
                ) : null}
              </div>
              <p className="truncate text-muted-foreground/60 text-xs">
                @{target.handle}
                {target.kind === "member" ? ` · ${target.description}` : ""}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
