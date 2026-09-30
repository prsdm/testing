import { normalizeAtlassianSourceLink } from "@/shared/connectors/providers/confluence/url";
import type { ChatMessage } from "@/shared/types";
import type { SearchResultChunk, SearchResultSourceType } from "./types";

export type SourceDocumentConnectorType = NonNullable<
  SearchResultChunk["sourceConnectorType"]
>;

export type CitationDocumentSourceType = SearchResultSourceType | "web";

export type CitedDocument = {
  /** Citation number shown inline in the answer, e.g. [1]. */
  document: number;
  documentId: string;
  title: string;
  link: string;
  content: string;
  /** Short excerpt for UI cards; full text stays in `content` for the model. */
  blurb?: string;
  updatedAt?: string;
  sourceType: CitationDocumentSourceType;
  sourceConnectorType?: SourceDocumentConnectorType;
};

export function getCitationBadgeKind(
  document: CitedDocument
): "source" | "web" {
  return document.sourceType === "web" ? "web" : "source";
}

/** Maps citation number → document id. */
export type CitationMap = Record<number, string>;

export const INTERNAL_SEARCH_CITATION_GUIDANCE = `When using these search results in your answer, cite relevant statements INLINE using [1], [2], [3], etc. matching the "document" field above. Do not add a separate sources list with raw URLs at the end.`;

/** Reminder appended to search context for inline citations. */
export const INTERNAL_SEARCH_CITATION_REMINDER = `Remember to provide inline citations in the format [1], [2], [3], etc. based on the "document" field of the documents.`;

export const CITATION_PLACEHOLDER_PREFIX = "#cite-";

/** Hash links survive Streamdown/rehype-harden; legacy cite: URLs are still recognized. */
export function citationMarkerHref(documentNumber: number) {
  return `${CITATION_PLACEHOLDER_PREFIX}${documentNumber}`;
}

export function isCitationMarkerHref(
  href: string | undefined,
  documentNumber: number
) {
  if (!href) {
    return false;
  }
  return (
    href === citationMarkerHref(documentNumber) ||
    href === `cite:${documentNumber}`
  );
}

export function buildCitationContextForDocuments(documents: CitedDocument[]) {
  const documentBlocks = documents
    .map((doc) =>
      [
        `document: ${doc.document}`,
        `title: ${doc.title}`,
        `url: ${doc.link}`,
        `source_type: ${doc.sourceType}`,
        ...(doc.sourceConnectorType
          ? [`source_connector_type: ${doc.sourceConnectorType}`]
          : []),
        `content: ${doc.content}`,
      ].join("\n")
    )
    .join("\n\n");

  return `${documentBlocks}\n\n${INTERNAL_SEARCH_CITATION_GUIDANCE}\n\n${INTERNAL_SEARCH_CITATION_REMINDER}`;
}

export function buildCitedDocumentsFromResults(
  results: SearchResultChunk[],
  citationStartNumber = 1
): {
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
} {
  if (results.length === 0) {
    return {
      citationMap: {},
      contextForLlm: "No internal documents matched the search.",
      documents: [],
    };
  }

  const byDocumentId = new Map<string, SearchResultChunk>();
  for (const result of results) {
    const existing = byDocumentId.get(result.documentId);
    if (!existing || result.score > existing.score) {
      byDocumentId.set(result.documentId, result);
    }
  }

  const sorted = [...byDocumentId.values()].sort((a, b) => b.score - a.score);

  const documents: CitedDocument[] = sorted.map((chunk, index) => ({
    blurb: chunk.blurb || undefined,
    content: chunk.content,
    document: citationStartNumber + index,
    documentId: chunk.documentId,
    link: normalizeAtlassianSourceLink(chunk.link),
    sourceConnectorType: chunk.sourceConnectorType,
    sourceType: chunk.sourceType,
    title: chunk.title,
    updatedAt: chunk.updatedAt,
  }));

  const citationMap: CitationMap = {};
  for (const doc of documents) {
    citationMap[doc.document] = doc.documentId;
  }

  const contextForLlm = buildCitationContextForDocuments(documents);

  return { citationMap, contextForLlm, documents };
}

export type InternalSearchToolOutput = {
  steps?: unknown[];
  documents?: CitedDocument[];
  citationMap?: CitationMap;
  contextForLlm?: string;
  error?: string;
};

const CITED_SEARCH_TOOL_TYPES = new Set([
  "tool-sourceSearch",
  "tool-knowledgeSearch",
  "tool-webSearch",
  "tool-openUrl",
]);

type CitedSearchToolOutput = {
  documents?: CitedDocument[];
};

export function collectCitationsFromMessageParts(
  parts: ChatMessage["parts"] | undefined
): Record<number, CitedDocument> {
  const byNumber: Record<number, CitedDocument> = {};

  if (!parts) {
    return byNumber;
  }

  for (const part of parts) {
    if (!CITED_SEARCH_TOOL_TYPES.has(part.type)) {
      continue;
    }
    if (
      !("state" in part) ||
      !("output" in part) ||
      part.state !== "output-available" ||
      !part.output
    ) {
      continue;
    }

    const output = part.output as CitedSearchToolOutput;
    for (const doc of output.documents ?? []) {
      const existing = byNumber[doc.document];
      if (existing && existing.documentId !== doc.documentId) {
        // Keep the first assignment when duplicate numbers come from later searches.
        continue;
      }
      byNumber[doc.document] = doc;
    }
  }

  return byNumber;
}

/** Turn inline [1] markers into markdown links so Streamdown can render citation chips. */
function sanitizeInlineCitationMarkers(text: string) {
  const normalizedBrackets = text
    .replaceAll("【", "[")
    .replaceAll("】", "]")
    .replaceAll("［", "[")
    .replaceAll("］", "]");

  const collapsedDoubleBrackets = normalizedBrackets.replace(
    /(?<!\[)\[\[(\d{1,2})\]\](?!\])/g,
    "[$1]"
  );

  const expandedCitationLists = collapsedDoubleBrackets.replace(
    /\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\](?!\()/g,
    (_match, value: string) =>
      value
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => `[${token}]`)
        .join(" ")
  );

  return expandedCitationLists.replace(/(\[\d{1,2}\])(?:\s+\1)+/g, "$1");
}

/**
 * Models sometimes wrap cited claims in square brackets before a marker:
 * `[Sol scores 53.6][1]` or `[Sol scores 53.6]. [1]`.
 * Strip those claim wrappers; keep short tokens like `[BofA]` and real `[1]` markers.
 */
function stripClaimWrappingBrackets(text: string) {
  return text
    .replace(/\[([^[\]]*\s[^[\]]*?)\](?=\s*\[\d{1,2}\])/g, "$1 ")
    .replace(/\[([^[\]]*\s[^[\]]*?)\]([.!?])(?=\s*\[\d{1,2}\])/g, "$1$2");
}

/** Keep one of each citation number in a consecutive cluster: `[1] [1] [2] [1]` → `[1] [2]`. */
function collapseDuplicateCitationMarkers(text: string) {
  return text.replace(/\[\d{1,2}\](?:\s*\[\d{1,2}\])+/g, (cluster) => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const match of cluster.matchAll(/\[(\d{1,2})\]/g)) {
      const marker = match[0];
      if (seen.has(marker)) {
        continue;
      }
      seen.add(marker);
      unique.push(marker);
    }
    return unique.join(" ");
  });
}

/**
 * Move citation markers to the end of the sentence they appear in.
 * e.g. `Revenue grew [1] this quarter.` → `Revenue grew this quarter. [1]`
 * and `finding [1]. here` → `finding. [1] here`.
 * Parenthetical citations like `(see [1])` are left untouched.
 */
function isInsideParentheses(textBefore: string): boolean {
  let depth = 0;
  for (const character of textBefore) {
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    }
  }
  return depth > 0;
}

function isAlreadyAfterSentenceEnd(textBefore: string): boolean {
  if (!/[.!?]["')\]]*\s*$/.test(textBefore)) {
    return false;
  }
  // Numbered list markers (`1. `, `12. `) are not sentence endings.
  if (/(?:^|\n)\s*\d+\.\s*$/.test(textBefore)) {
    return false;
  }
  return true;
}

/**
 * Offset into `after` at which to insert the citation (immediately after the
 * sentence-ending punctuation, or at the end of the line / string).
 */
function findCitationInsertOffset(after: string): number {
  for (let index = 0; index < after.length; index++) {
    const character = after.charAt(index);
    if (character === "\n") {
      return index;
    }
    if (character !== "." && character !== "!" && character !== "?") {
      continue;
    }

    // Skip decimals like 20.1
    if (
      character === "." &&
      index > 0 &&
      /\d/.test(after.charAt(index - 1)) &&
      index + 1 < after.length &&
      /\d/.test(after.charAt(index + 1))
    ) {
      continue;
    }

    // Skip ellipsis …
    if (character === "." && after.slice(index, index + 3) === "...") {
      index += 2;
      continue;
    }

    let cursor = index + 1;
    while (cursor < after.length && /["')\]]/.test(after.charAt(cursor))) {
      cursor += 1;
    }
    if (cursor >= after.length || /\s/.test(after.charAt(cursor))) {
      return cursor;
    }
  }

  return after.length;
}

function joinCitationRelocation(
  before: string,
  between: string,
  group: string,
  rest: string
): string {
  const beforeTrimmed = before.replace(/[ \t]+$/g, "");
  const betweenTrimmed = between.replace(/^[ \t]+/g, "");
  const restTrimmed = rest.replace(/^[ \t]+/g, "");

  let head = beforeTrimmed;
  if (
    head.length > 0 &&
    betweenTrimmed.length > 0 &&
    !/^[.!?\n]/.test(betweenTrimmed) &&
    !/[\s([{/:]$/.test(head)
  ) {
    head += " ";
  }
  head += betweenTrimmed;

  const citeGap = head.length > 0 && !/\s$/.test(head) ? " " : "";
  let tail = "";
  if (restTrimmed.length > 0) {
    tail = restTrimmed.startsWith("\n") ? restTrimmed : ` ${restTrimmed}`;
  }

  return `${head}${citeGap}${group}${tail}`;
}

function repositionCitationsAfterPunctuation(text: string) {
  const citationGroupPattern = /\[\d{1,2}\](?:\s*\[\d{1,2}\])*/g;
  const matches = [...text.matchAll(citationGroupPattern)];
  if (matches.length === 0) {
    return text;
  }

  let result = text;

  for (let index = matches.length - 1; index >= 0; index--) {
    const match = matches[index];
    if (!match || match.index === undefined) {
      continue;
    }

    const start = match.index;
    const group = match[0];
    const end = start + group.length;
    const before = result.slice(0, start);
    const after = result.slice(end);

    if (isInsideParentheses(before) || isAlreadyAfterSentenceEnd(before)) {
      continue;
    }

    const insertIntoAfter = findCitationInsertOffset(after);
    // Already immediately before sentence punctuation: `word [1].` → move past `.`
    // Mid-sentence with no end yet: move to end of line / string.
    // Skip only if citation would stay in the same place (insert at 0 and after
    // does not start with sentence punctuation).
    if (insertIntoAfter === 0 && !/^[.!?]/.test(after)) {
      continue;
    }

    result = joinCitationRelocation(
      before,
      after.slice(0, insertIntoAfter),
      group,
      after.slice(insertIntoAfter)
    );
  }

  return collapseDuplicateCitationMarkers(
    result
      .replace(/([.!?])[ \t]*(\[\d)/g, "$1 $2")
      .replace(/(\[\d{1,2}\])([A-Za-z])/g, "$1 $2")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
  );
}

export function linkifyInlineCitations(
  text: string,
  citations: Record<number, CitedDocument>
) {
  if (Object.keys(citations).length === 0) {
    return text;
  }

  const repositioned = repositionCitationsAfterPunctuation(
    stripClaimWrappingBrackets(sanitizeInlineCitationMarkers(text))
  );

  return repositioned.replace(
    /(?<!\[)\[(\d{1,2})\](?!\()/g,
    (match, rawNum: string) => {
      const num = Number.parseInt(rawNum, 10);
      const doc = citations[num];
      if (!doc) {
        return match;
      }
      const href = doc.link?.trim() || citationMarkerHref(num);
      return `[${num}](${href})`;
    }
  );
}
