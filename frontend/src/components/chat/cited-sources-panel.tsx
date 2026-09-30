"use client";

import { isInternalCitationKind } from "@/shared/search/source-type-compat";
import { CitedSourceCard } from "./cited-source-card";
import type { BottomSource } from "./message";

function isWebSource(source: BottomSource) {
  return source.kind === "web" || source.kind === "api";
}

function groupCitedSources(sources: BottomSource[]) {
  const knowledgeSources = sources.filter((source) =>
    isInternalCitationKind(source.kind)
  );
  const webSources = sources.filter(isWebSource);
  const showSections = knowledgeSources.length > 0 && webSources.length > 0;

  return {
    knowledgeSources,
    showSections,
    webSources,
  };
}

function SourceSection({
  label,
  sources,
}: {
  label: string;
  sources: BottomSource[];
}) {
  return (
    <section className="flex flex-col gap-1">
      <p className="px-2.5 pt-1 pb-0.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </p>
      {sources.map((source) => (
        <CitedSourceCard key={source.key} source={source} />
      ))}
    </section>
  );
}

export function CitedSourcesPanel({ sources }: { sources: BottomSource[] }) {
  const { knowledgeSources, webSources, showSections } =
    groupCitedSources(sources);

  if (!showSections) {
    return (
      <div className="flex flex-col gap-1">
        {sources.map((source) => (
          <CitedSourceCard key={source.key} source={source} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SourceSection label="Internal" sources={knowledgeSources} />
      <SourceSection label="Web" sources={webSources} />
    </div>
  );
}
