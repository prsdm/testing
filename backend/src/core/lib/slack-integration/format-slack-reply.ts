import { normalizeMarkdownLists } from "@/shared/markdown/normalize-assistant-markdown";
import type { CitedDocument } from "@/shared/search/citations";

export const SLACK_MESSAGE_MAX_LEN = 4000;
export const SLACK_MARKDOWN_BLOCK_MAX_LEN = 12_000;
export const SLACK_MAX_BLOCKS = 50;
export const SLACK_MAX_CAROUSEL_CARDS = 10;

export function formatSlackReplyText(text: string | null | undefined) {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= SLACK_MESSAGE_MAX_LEN) {
    return trimmed;
  }
  return `${trimmed.slice(0, SLACK_MESSAGE_MAX_LEN)}…`;
}

function stripSlackMrkdwn(text: string) {
  return text
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~([^~]+)~/g, "$1")
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`\n]+)`/g, "$1");
}

const MARKDOWN_PLACEHOLDER = "\uE000";

/** Convert common assistant markdown into Slack mrkdwn for plain-text fallbacks. */
export function convertMarkdownToSlackMrkdwn(text: string) {
  const normalized = normalizeMarkdownLists(text);
  const codeBlocks: string[] = [];
  let converted = normalized.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `${MARKDOWN_PLACEHOLDER}CODE${codeBlocks.length - 1}${MARKDOWN_PLACEHOLDER}`;
  });

  const inlineCodes: string[] = [];
  converted = converted.replace(/`([^`\n]+)`/g, (match) => {
    inlineCodes.push(match);
    return `${MARKDOWN_PLACEHOLDER}INLINE${inlineCodes.length - 1}${MARKDOWN_PLACEHOLDER}`;
  });

  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");
  converted = converted.replace(/\*\*([^*]+)\*\*/g, "*$1*");
  converted = converted.replace(/__([^_]+)__/g, "*$1*");

  const inlinePattern = new RegExp(
    `${MARKDOWN_PLACEHOLDER}INLINE(\\d+)${MARKDOWN_PLACEHOLDER}`,
    "g"
  );
  const codePattern = new RegExp(
    `${MARKDOWN_PLACEHOLDER}CODE(\\d+)${MARKDOWN_PLACEHOLDER}`,
    "g"
  );
  converted = converted.replace(
    inlinePattern,
    (_, index: string) => inlineCodes[Number(index)] ?? ""
  );
  converted = converted.replace(
    codePattern,
    (_, index: string) => codeBlocks[Number(index)] ?? ""
  );

  return converted.trim();
}

export function citationNumbersInText(text: string) {
  const numbers = new Set<number>();
  for (const match of text.matchAll(/\[(\d{1,2})\]/g)) {
    const parsed = Number.parseInt(match[1] ?? "", 10);
    if (Number.isFinite(parsed)) {
      numbers.add(parsed);
    }
  }
  return numbers;
}

export function filterCitationsReferencedInText(
  text: string,
  citations: Record<number, CitedDocument>
) {
  const referenced = citationNumbersInText(text);
  if (referenced.size === 0) {
    return citations;
  }

  const filtered: Record<number, CitedDocument> = {};
  for (const number of referenced) {
    const document = citations[number];
    if (document) {
      filtered[number] = document;
    }
  }
  return filtered;
}

export function stripInlineCitationMarkers(text: string) {
  return text
    .replace(/\s*\*\*\[\d{1,2}\]\*\*/g, "")
    .replace(/\s*\[\d{1,2}\](?=\s|[.!?,;:)\]]|$)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntroAndBody(text: string) {
  const normalized = normalizeMarkdownLists(text);
  const splitAt = normalized.indexOf("\n\n");
  if (splitAt <= 0) {
    return { body: normalized, intro: null };
  }

  const intro = normalized.slice(0, splitAt).trim();
  const body = normalized.slice(splitAt + 2).trim();
  if (!body || intro.length > 320) {
    return { body: normalized, intro: null };
  }

  return { body, intro };
}

function splitMarkdownBlocks(text: string, maxLen: number) {
  if (text.length <= maxLen) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen / 2) {
      splitAt = remaining.lastIndexOf("\n", maxLen);
    }
    if (splitAt < maxLen / 2) {
      splitAt = maxLen;
    }
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks.filter(Boolean);
}

function citationCardSubtitle(document: CitedDocument) {
  const link = document.link?.trim();
  if (link) {
    try {
      return new URL(link).hostname.replace(/^www\./, "");
    } catch {
      return link;
    }
  }

  if (document.sourceConnectorType) {
    return document.sourceConnectorType.replace(/_/g, " ");
  }

  if (document.sourceType && document.sourceType !== "web") {
    return document.sourceType.replace(/_/g, " ");
  }

  return "Knowledge base source";
}

function citationCardBody(document: CitedDocument) {
  const preview = document.blurb?.trim() || document.content?.trim();
  if (!preview) {
    return "Indexed knowledge base source.";
  }
  if (preview.length <= 200) {
    return preview;
  }
  return `${preview.slice(0, 197).trimEnd()}...`;
}

function buildCitationCarouselCards(
  citations: Record<number, CitedDocument>
): Record<string, unknown>[] {
  return Object.entries(citations)
    .map(([rawNumber, document]) => ({
      document,
      number: Number.parseInt(rawNumber, 10),
    }))
    .filter((entry) => Number.isFinite(entry.number))
    .sort((left, right) => left.number - right.number)
    .slice(0, SLACK_MAX_CAROUSEL_CARDS)
    .map(({ number, document }) => {
      const title = (document.title || `Source ${number}`).slice(0, 150);
      const card: Record<string, unknown> = {
        block_id: `source-${number}`,
        body: {
          text: citationCardBody(document),
          type: "mrkdwn",
          verbatim: false,
        },
        subtitle: {
          text: citationCardSubtitle(document),
          type: "mrkdwn",
          verbatim: false,
        },
        title: {
          text: title,
          type: "mrkdwn",
          verbatim: false,
        },
        type: "card",
      };

      const link = document.link?.trim();
      if (link) {
        card.actions = [
          {
            action_id: `read_source_${number}`,
            text: {
              emoji: false,
              text: "Read",
              type: "plain_text",
            },
            type: "button",
            url: link,
          },
        ];
      }

      return card;
    });
}

/** Rich Slack layout: intro section + markdown block + references heading + source carousel. */
export function buildSlackReplyBlocks(
  text: string,
  citations: Record<number, CitedDocument> = {}
) {
  const cleaned = stripInlineCitationMarkers(text);
  const { intro, body } = splitIntroAndBody(cleaned);
  const blocks: Record<string, unknown>[] = [];

  if (intro) {
    blocks.push({
      text: {
        text: convertMarkdownToSlackMrkdwn(intro).slice(0, 3000),
        type: "mrkdwn",
      },
      type: "section",
    });
  }

  for (const chunk of splitMarkdownBlocks(body, SLACK_MARKDOWN_BLOCK_MAX_LEN)) {
    if (blocks.length >= SLACK_MAX_BLOCKS - 2) {
      break;
    }
    blocks.push({
      text: chunk,
      type: "markdown",
    });
  }

  const cards = buildCitationCarouselCards(citations);
  if (cards.length > 0 && blocks.length < SLACK_MAX_BLOCKS - 1) {
    blocks.push({
      text: {
        text: "*References*",
        type: "mrkdwn",
      },
      type: "section",
    });
    blocks.push({
      elements: cards,
      type: "carousel",
    });
  }

  return blocks.slice(0, SLACK_MAX_BLOCKS);
}

export function buildSlackReplyPresentation(
  text: string | null | undefined,
  citations: Record<number, CitedDocument> = {}
): {
  text: string;
  blocks: Record<string, unknown>[];
} | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }

  const referencedCitations = filterCitationsReferencedInText(
    trimmed,
    citations
  );
  const cleaned = stripInlineCitationMarkers(trimmed);
  const fallback =
    formatSlackReplyText(
      stripSlackMrkdwn(convertMarkdownToSlackMrkdwn(cleaned))
    ) ?? trimmed.slice(0, SLACK_MESSAGE_MAX_LEN);

  return {
    blocks: buildSlackReplyBlocks(trimmed, referencedCitations),
    text: fallback,
  };
}
