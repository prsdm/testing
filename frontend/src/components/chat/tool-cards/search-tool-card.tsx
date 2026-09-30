"use client";

import { DatabaseIcon, GlobeIcon, UsersIcon } from "lucide-react";
import {
  extractKnowledgeBaseNameFromInput,
  resolveSearchDisplayQueries,
  resolveSearchStepSummary,
  sanitizeSearchOutputForDisplay,
  searchToolHasExpandableBody,
  unwrapSearchToolResultOutput,
} from "@/lib/chat/search-tool-display";
import { Shimmer } from "../../ai-elements/shimmer";
import { ToolCallCard } from "./tool-call-card";
import { ToolCardSection, ToolCardSurface } from "./tool-card-surface";
import { ToolJsonSection } from "./tool-json-section";
import type { ToolCallStatus } from "./tool-status-icon";

export type SearchToolCardVariant = "knowledge" | "web" | "people";

type SearchToolCardProps = {
  variant: SearchToolCardVariant;
  input?: unknown;
  output?: unknown;
  isPending: boolean;
  isInterrupted?: boolean;
  isKnowledgeBaseScope?: boolean;
  nested?: boolean;
};

function searchLeadingIcon(variant: SearchToolCardVariant) {
  if (variant === "web") {
    return <GlobeIcon aria-hidden />;
  }
  if (variant === "people") {
    return <UsersIcon aria-hidden />;
  }
  return <DatabaseIcon aria-hidden />;
}

/** Search tool row: icon, plain label, status, chevron. */
export function SearchToolCard({
  variant,
  input,
  output,
  isPending,
  isInterrupted = false,
  isKnowledgeBaseScope = false,
  nested = false,
}: SearchToolCardProps) {
  const { title, pendingLabel, isPendingLabel } = resolveSearchStepSummary({
    input,
    isInterrupted,
    isKnowledgeBaseScope: variant === "knowledge" && isKnowledgeBaseScope,
    isPending,
    output,
    variant,
  });

  const displayOutput = sanitizeSearchOutputForDisplay(
    unwrapSearchToolResultOutput(output)
  );
  const expandable =
    !isInterrupted &&
    searchToolHasExpandableBody({
      input,
      isPending,
      output,
    });

  const status: ToolCallStatus = isPending
    ? "pending"
    : isInterrupted
      ? "interrupted"
      : "completed";

  const knowledgeBaseName =
    variant === "knowledge" && isKnowledgeBaseScope
      ? extractKnowledgeBaseNameFromInput(input)
      : undefined;
  const queries = resolveSearchDisplayQueries(
    input,
    isPending || isInterrupted ? undefined : output
  );

  const label = isPendingLabel ? (
    <Shimmer as="span" duration={1}>
      {pendingLabel}
    </Shimmer>
  ) : (
    title
  );

  const body = expandable ? (
    <ToolCardSurface>
      {knowledgeBaseName ? (
        <ToolCardSection>
          <p className="text-muted-foreground text-xs">
            Knowledge base: {knowledgeBaseName}
          </p>
        </ToolCardSection>
      ) : null}
      {queries.length > 0 ? (
        <ToolCardSection divider={Boolean(knowledgeBaseName)}>
          <p className="mb-1 text-muted-foreground text-xs">Queries</p>
          <p className="text-foreground/90 text-sm">{queries.join(", ")}</p>
        </ToolCardSection>
      ) : null}
      <ToolCardSection
        divider={Boolean(knowledgeBaseName) || queries.length > 0}
        tinted={Boolean(knowledgeBaseName) || queries.length > 0}
      >
        <ToolJsonSection value={displayOutput} />
      </ToolCardSection>
    </ToolCardSurface>
  ) : null;

  return (
    <ToolCallCard
      defaultOpen={false}
      dense
      expandable={expandable}
      label={label}
      leadingIcon={searchLeadingIcon(variant)}
      nested={nested}
      status={status}
    >
      {body}
    </ToolCallCard>
  );
}
