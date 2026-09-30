"use client";

import { useEffect, useRef } from "react";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import { KimiroIconTile } from "@/components/chat/kimiro-icon";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { WorkSkillIcon } from "@/components/connectors/work-skill-card";
import { McpIcon } from "@/components/icons/mcp-icon";
import type { RoomMentionTarget } from "@/lib/chat/room-mention-autocomplete";
import type { ConnectorMentionTarget } from "@/lib/connectors/connector-mention-targets";
import { cn } from "@/shared/utils";

export type ComposerMentionPick =
  | { kind: "room"; target: RoomMentionTarget }
  | { kind: "connector"; target: ConnectorMentionTarget };

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

function pickKey(pick: ComposerMentionPick) {
  if (pick.kind === "room") {
    return pick.target.kind === "agent"
      ? "agent-kimiro"
      : `member-${pick.target.userId}`;
  }
  return `connector-${pick.target.handle}-${pick.target.label}`;
}

export function ComposerMentionPicker({
  picks,
  selectedIndex,
  onSelect,
}: {
  picks: ComposerMentionPick[];
  selectedIndex: number;
  onSelect: (pick: ComposerMentionPick) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll selected row into view
  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (picks.length === 0) {
    return null;
  }

  const hasRoom = picks.some((pick) => pick.kind === "room");
  const hasConnector = picks.some((pick) => pick.kind === "connector");
  let sawRoom = false;
  let sawConnector = false;

  return (
    <div
      className="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-(--shadow-float) backdrop-blur-xl"
      ref={menuRef}
    >
      <div className="max-h-72 overflow-y-auto pb-1 no-scrollbar">
        {picks.map((pick, index) => {
          const showPeopleHeader = pick.kind === "room" && !sawRoom && hasRoom;
          const showConnectorsHeader =
            pick.kind === "connector" && !sawConnector && hasConnector;
          if (pick.kind === "room") {
            sawRoom = true;
          } else {
            sawConnector = true;
          }

          return (
            <div key={pickKey(pick)}>
              {showPeopleHeader ? (
                <div className="px-4 py-2.5 font-medium text-muted-foreground/40 text-xs uppercase tracking-wider">
                  People
                </div>
              ) : null}
              {showConnectorsHeader ? (
                <div
                  className={cn(
                    "px-4 py-2.5 font-medium text-muted-foreground/40 text-xs uppercase tracking-wider",
                    hasRoom && "border-border/50 border-t"
                  )}
                >
                  Connectors
                </div>
              ) : null}
              <button
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  index === selectedIndex ? "bg-muted/70" : "hover:bg-muted/40"
                )}
                data-selected={index === selectedIndex}
                onClick={() => onSelect(pick)}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {pick.kind === "room" ? (
                  <>
                    {pick.target.kind === "agent" ? (
                      <KimiroIconTile className="shrink-0" size="sm" />
                    ) : (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground text-xs">
                        {pick.target.label.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground text-sm">
                          {pick.target.label}
                        </span>
                        {pick.target.kind === "agent" ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
                            Agent
                          </span>
                        ) : pick.target.isSelf ? (
                          <span className="text-muted-foreground text-xs">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-muted-foreground/60 text-xs">
                        @{pick.target.handle}
                        {pick.target.kind === "member"
                          ? ` · ${pick.target.description}`
                          : ""}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ConnectorMentionIcon target={pick.target} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground text-sm">
                        {pick.target.label}
                      </div>
                      <p className="truncate text-muted-foreground/70 text-xs">
                        {pick.target.description}
                      </p>
                    </div>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="border-border/50 border-t px-4 py-2 text-muted-foreground/60 text-xs">
        Type to filter people, connectors, and built-in tools
      </div>
    </div>
  );
}
