"use client";

import { useEffect, useRef } from "react";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { WorkSkillIcon } from "@/components/connectors/work-skill-card";
import { McpIcon } from "@/components/icons/mcp-icon";
import type { ConnectorMentionTarget } from "@/lib/connectors/connector-mention-targets";
import { cn } from "@/shared/utils";

function ConnectorMentionIcon({ target }: { target: ConnectorMentionTarget }) {
  return (
    <AdminListItemLogoFrame className="size-8 rounded-lg p-1.5">
      {target.icon.kind === "work-skill" ? (
        <WorkSkillIcon
          className="size-full max-h-5 max-w-5 object-contain"
          skillId={target.icon.skillId}
        />
      ) : target.icon.kind === "mcp" ? (
        <McpIcon className="size-full max-h-5 max-w-5 text-muted-foreground" />
      ) : (
        <ConnectorProviderIcon
          className="size-full max-h-5 max-w-5 object-contain"
          provider={target.icon.provider}
        />
      )}
    </AdminListItemLogoFrame>
  );
}

export function ConnectorMentionMenu({
  targets,
  selectedIndex,
  onSelect,
}: {
  targets: ConnectorMentionTarget[];
  selectedIndex: number;
  onSelect: (target: ConnectorMentionTarget) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll selected row into view
  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-(--shadow-float) backdrop-blur-xl"
      ref={menuRef}
    >
      <div className="px-4 py-2.5 font-medium text-muted-foreground/40 text-xs uppercase tracking-wider">
        Connectors
      </div>
      <div className="max-h-72 overflow-y-auto pb-1 no-scrollbar">
        {targets.map((target, index) => (
          <button
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
              index === selectedIndex ? "bg-muted/70" : "hover:bg-muted/40"
            )}
            data-selected={index === selectedIndex}
            key={`${target.handle}-${target.label}`}
            onClick={() => onSelect(target)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <ConnectorMentionIcon target={target} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground text-sm">
                {target.label}
              </div>
              <p className="truncate text-muted-foreground/70 text-xs">
                {target.description}
              </p>
            </div>
          </button>
        ))}
      </div>
      <div className="border-border/50 border-t px-4 py-2 text-muted-foreground/60 text-xs">
        Type to filter connectors and built-in tools
      </div>
    </div>
  );
}
