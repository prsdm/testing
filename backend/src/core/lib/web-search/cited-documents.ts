import { webDocumentId } from "@/core/lib/search/citation-context";
import type { CitedDocument } from "@/shared/search/citations";
import type { OpenUrlResultItem, WebSearchResultItem } from "./output";

const UI_BLURB_MAX_LENGTH = 200;

function truncateBlurb(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= UI_BLURB_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, UI_BLURB_MAX_LENGTH).trimEnd()}…`;
}

export function citedDocumentsFromWebSearchResults(
  results: WebSearchResultItem[],
  contentByUrl?: Map<string, string>
): CitedDocument[] {
  return results.map((result) => {
    const fullContent = contentByUrl?.get(result.url)?.trim();
    const content = fullContent || result.snippet;
    return {
      blurb: result.snippet || truncateBlurb(content),
      content,
      document: 0,
      documentId: webDocumentId(result.url),
      link: result.url,
      sourceType: "web",
      title: result.title,
    };
  });
}

export function citedDocumentsFromOpenUrlResults(
  results: OpenUrlResultItem[]
): CitedDocument[] {
  return results
    .filter((result) => result.content.trim().length > 0 && !result.error)
    .map((result) => ({
      blurb: truncateBlurb(result.content),
      content: result.content,
      document: 0,
      documentId: webDocumentId(result.url),
      link: result.url,
      sourceType: "web",
      title: result.title.trim() || result.url,
    }));
}

/** UI citation chips only need metadata, not full page text. */
export function toUiCitedWebDocument(document: CitedDocument): CitedDocument {
  return {
    blurb: document.blurb,
    content: "",
    document: document.document,
    documentId: document.documentId,
    link: document.link,
    sourceType: document.sourceType,
    title: document.title,
  };
}
