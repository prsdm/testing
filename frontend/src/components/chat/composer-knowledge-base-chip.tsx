"use client";

import { FolderKanbanIcon, XIcon } from "lucide-react";
import useSWR from "swr";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KnowledgeBaseSummary as KnowledgeBase } from "@/contracts/knowledge-bases";
import { cn, fetcher } from "@/shared/utils";

export type ComposerKnowledgeBaseSelection = {
  id: string;
  name: string;
} | null;

type ComposerKnowledgeBaseChipProps = {
  disabled?: boolean;
  knowledgeBase: ComposerKnowledgeBaseSelection;
  onKnowledgeBaseChange: (
    knowledgeBase: ComposerKnowledgeBaseSelection
  ) => void;
};

export function ComposerKnowledgeBaseChip({
  disabled = false,
  knowledgeBase,
  onKnowledgeBaseChange,
}: ComposerKnowledgeBaseChipProps) {
  const tenantSlug = useTenantSlug();
  const { data } = useSWR<{ knowledgeBases: KnowledgeBase[] }>(
    tenantSlug
      ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/knowledge-bases/${tenantSlug}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const knowledgeBases = data?.knowledgeBases ?? [];
  const label = knowledgeBase?.name ?? "No knowledge base";

  return (
    <DropdownMenu>
      <div
        className={cn(
          "inline-flex h-8 max-w-[220px] items-center gap-1 rounded-lg pl-2 pr-1 font-medium text-sm",
          knowledgeBase
            ? "bg-muted/80 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled && "pointer-events-none opacity-60"
        )}
        data-testid="composer-knowledge-base-chip"
      >
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-left disabled:cursor-not-allowed"
            disabled={disabled}
            type="button"
          >
            <FolderKanbanIcon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </DropdownMenuTrigger>
        {knowledgeBase ? (
          <button
            aria-label="Remove knowledge base from chat"
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted disabled:cursor-not-allowed"
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onKnowledgeBaseChange(null);
            }}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        ) : null}
      </div>
      <DropdownMenuContent
        align="start"
        className="z-100 max-h-72 min-w-56 overflow-y-auto rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
      >
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onKnowledgeBaseChange(null)}
        >
          No knowledge base
        </DropdownMenuItem>
        {knowledgeBases.map((entry) => (
          <DropdownMenuItem
            className="rounded-lg"
            key={entry.id}
            onClick={() =>
              onKnowledgeBaseChange({ id: entry.id, name: entry.name })
            }
          >
            {entry.name}
          </DropdownMenuItem>
        ))}
        {knowledgeBases.length === 0 ? (
          <DropdownMenuItem
            className="rounded-lg text-muted-foreground"
            disabled
          >
            No knowledge bases yet
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
