/**
 * Extracts text from Google Docs using the Docs API.
 *
 * The Drive export endpoint (`?alt=export&mimeType=text/plain`) silently drops
 * tables, smart chips, drawings, and rich-link text, causing docs that rely on
 * those elements to return empty and be skipped. The Docs API returns the full
 * document JSON so nothing is lost.
 */

type TextRun = {
  content?: string;
  textStyle?: { link?: { url?: string } };
};

type Person = {
  personProperties?: { name?: string; email?: string };
};

type RichLink = {
  richLinkProperties?: { title?: string; uri?: string };
};

type ParagraphElement = {
  textRun?: TextRun;
  person?: Person;
  richLink?: RichLink;
};

type Paragraph = {
  elements?: ParagraphElement[];
  paragraphStyle?: { namedStyleType?: string; headingId?: string };
};

type TableCell = {
  content?: StructuralElement[];
};

type TableRow = {
  tableCells?: TableCell[];
};

type Table = {
  tableRows?: TableRow[];
};

type StructuralElement = {
  paragraph?: Paragraph;
  table?: Table;
};

type DocsApiDocument = {
  tabs?: Array<{
    documentTab?: {
      body?: { content?: StructuralElement[] };
    };
    tabId?: string;
  }>;
  body?: { content?: StructuralElement[] };
};

function extractParagraphText(paragraph: Paragraph): string {
  const parts: string[] = [];
  for (const el of paragraph.elements ?? []) {
    if (el.textRun?.content) {
      parts.push(el.textRun.content);
    }
    if (el.textRun?.textStyle?.link?.url) {
      parts.push(`(${el.textRun.textStyle.link.url})`);
    }
    if (el.person) {
      const name = el.person.personProperties?.name ?? "";
      const email = el.person.personProperties?.email ?? "";
      parts.push(`<Person|name: ${name}, email: ${email}>`);
    }
    if (el.richLink) {
      const title = el.richLink.richLinkProperties?.title ?? "";
      const uri = el.richLink.richLinkProperties?.uri ?? "";
      parts.push(`[${title}](${uri})`);
    }
  }
  return parts.join("");
}

function extractTableText(table: Table): string {
  return (table.tableRows ?? [])
    .map((row) =>
      (row.tableCells ?? [])
        .map((cell) =>
          (cell.content ?? [])
            .flatMap((el) =>
              el.paragraph ? [extractParagraphText(el.paragraph)] : []
            )
            .join("")
        )
        .join(", ")
    )
    .join("\n");
}

function walkContent(content: StructuralElement[]): string {
  const lines: string[] = [];
  for (const el of content) {
    if (el.paragraph) {
      const text = extractParagraphText(el.paragraph).replace(/\n$/, "");
      if (text.trim()) {
        lines.push(text);
      }
    } else if (el.table) {
      const text = extractTableText(el.table).trim();
      if (text) {
        lines.push(text);
      }
    }
  }
  return lines.join("\n");
}

/**
 * Call the Google Docs API and return the full document text.
 * Falls back to null so the caller can use the Drive export fallback.
 */
export async function extractGoogleDocText(
  docId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?includeTabsContent=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      return null;
    }
    const doc = (await response.json()) as DocsApiDocument;

    const allText: string[] = [];

    if (doc.tabs && doc.tabs.length > 0) {
      for (const tab of doc.tabs) {
        const content = tab.documentTab?.body?.content ?? [];
        const text = walkContent(content).trim();
        if (text) {
          allText.push(text);
        }
      }
    } else {
      const content = doc.body?.content ?? [];
      const text = walkContent(content).trim();
      if (text) {
        allText.push(text);
      }
    }

    const combined = allText.join("\n\n").trim();
    return combined.length > 0 ? combined : null;
  } catch {
    return null;
  }
}
