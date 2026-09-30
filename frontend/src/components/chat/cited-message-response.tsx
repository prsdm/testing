"use client";

import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { normalizeMarkdownLists } from "@/shared/markdown/normalize-assistant-markdown";
import {
  type CitedDocument,
  isCitationMarkerHref,
  linkifyInlineCitations,
} from "@/shared/search/citations";
import { CitationChip } from "./citation-chip";

export function CitedMessageResponse({
  children,
  citations,
  ...props
}: ComponentProps<typeof MessageResponse> & {
  citations: Record<number, CitedDocument>;
}) {
  const text = typeof children === "string" ? children : "";
  const linkedText = useMemo(
    () => linkifyInlineCitations(normalizeMarkdownLists(text), citations),
    [text, citations]
  );

  const components = useMemo(() => {
    if (Object.keys(citations).length === 0) {
      return;
    }

    return {
      a: ({
        href,
        children: linkChildren,
      }: {
        href?: string;
        children?: ReactNode;
      }) => {
        const label = String(linkChildren ?? "").trim();
        const num = Number.parseInt(label, 10);
        const citedDocument = citations[num];
        const matchesCitation =
          Number.isFinite(num) &&
          citedDocument &&
          (href === citedDocument.link || isCitationMarkerHref(href, num));
        if (matchesCitation) {
          return <CitationChip document={citedDocument} number={num} />;
        }

        return (
          <a
            className="text-primary underline underline-offset-2"
            href={href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {linkChildren}
          </a>
        );
      },
    };
  }, [citations]);

  return (
    <MessageResponse components={components} {...props}>
      {linkedText}
    </MessageResponse>
  );
}
