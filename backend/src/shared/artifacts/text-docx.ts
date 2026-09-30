import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  type ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import JSZip from "jszip";

/** Stored text documents use this prefix + base64 docx bytes. */
export const DOCX_CONTENT_PREFIX = "docx:base64:";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** User-facing Word filename (always .docx). */
export function textDocumentFileName(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    return "Document.docx";
  }
  if (/\.docx$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\.(md|markdown|txt|doc)$/i.test(trimmed)) {
    return `${trimmed.replace(/\.(md|markdown|txt|doc)$/i, "")}.docx`;
  }
  return `${trimmed}.docx`;
}

export function isDocxStoredContent(content: string) {
  return content.startsWith(DOCX_CONTENT_PREFIX);
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseInlineMarkdown(text: string): ParagraphChild[] {
  const children: ParagraphChild[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      children.push(new TextRun(text.slice(lastIndex, match.index)));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      children.push(new TextRun({ bold: true, text: token.slice(2, -2) }));
    } else if (token.startsWith("*") && token.endsWith("*")) {
      children.push(new TextRun({ italics: true, text: token.slice(1, -1) }));
    } else if (token.startsWith("`") && token.endsWith("`")) {
      children.push(new TextRun({ text: token.slice(1, -1) }));
    } else {
      children.push(new TextRun(token));
    }
    lastIndex = match.index + token.length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    children.push(new TextRun(text.slice(lastIndex)));
  }

  if (children.length === 0) {
    children.push(new TextRun(""));
  }

  return children;
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

const TABLE_BORDER = {
  color: "999999",
  size: 4,
  style: BorderStyle.SINGLE,
};

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!(trimmed.startsWith("|") && trimmed.includes("|", 1))) {
    return null;
  }
  const raw = trimmed.split("|");
  const start = raw.at(0)?.trim() === "" ? 1 : 0;
  const end = raw.at(-1)?.trim() === "" ? raw.length - 1 : raw.length;
  return raw.slice(start, end).map((cell) => cell.trim());
}

function isMarkdownTableSeparator(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{1,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function looksLikeMarkdownTableHeader(lines: string[], index: number): boolean {
  const header = parseMarkdownTableRow(lines[index] ?? "");
  const separator = parseMarkdownTableRow(lines[index + 1] ?? "");
  return Boolean(
    header &&
      separator &&
      isMarkdownTableSeparator(separator) &&
      header.length === separator.length
  );
}

function buildDocxTable(rows: string[][]): Table {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const width = Math.floor(9000 / columnCount);

  return new Table({
    columnWidths: Array.from({ length: columnCount }, () => width),
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          children: Array.from({ length: columnCount }, (_, colIndex) => {
            const text = row[colIndex] ?? "";
            return new TableCell({
              borders: {
                bottom: TABLE_BORDER,
                left: TABLE_BORDER,
                right: TABLE_BORDER,
                top: TABLE_BORDER,
              },
              children: [
                new Paragraph({
                  children: parseInlineMarkdown(text),
                }),
              ],
              shading:
                rowIndex === 0
                  ? { fill: "F3F4F6", type: ShadingType.CLEAR }
                  : undefined,
              width: { size: width, type: WidthType.DXA },
            });
          }),
        })
    ),
    width: { size: 9000, type: WidthType.DXA },
  });
}

/** Build a .docx from markdown (LLM / editor intermediate form). */
export async function encodeMarkdownAsDocxContent(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const children: Array<Paragraph | Table> = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";

    // GFM pipe tables → real Word tables
    if (looksLikeMarkdownTableHeader(lines, lineIndex)) {
      const tableRows: string[][] = [];
      const header = parseMarkdownTableRow(line);
      if (header) {
        tableRows.push(header);
      }
      lineIndex += 2; // skip header + separator
      while (lineIndex < lines.length) {
        const row = parseMarkdownTableRow(lines[lineIndex] ?? "");
        if (!row) {
          break;
        }
        tableRows.push(row);
        lineIndex += 1;
      }
      if (tableRows.length > 0) {
        children.push(buildDocxTable(tableRows));
      }
      continue;
    }

    // Fenced block that is itself a markdown table (editor preservation path)
    if (line.trim().startsWith("```")) {
      const fenceLines: string[] = [];
      lineIndex += 1;
      while (
        lineIndex < lines.length &&
        !lines[lineIndex]?.trim().startsWith("```")
      ) {
        fenceLines.push(lines[lineIndex] ?? "");
        lineIndex += 1;
      }
      if (lineIndex < lines.length) {
        lineIndex += 1; // closing fence
      }
      if (looksLikeMarkdownTableHeader(fenceLines, 0)) {
        const tableRows: string[][] = [];
        const header = parseMarkdownTableRow(fenceLines[0] ?? "");
        if (header) {
          tableRows.push(header);
        }
        for (let i = 2; i < fenceLines.length; i++) {
          const row = parseMarkdownTableRow(fenceLines[i] ?? "");
          if (row) {
            tableRows.push(row);
          }
        }
        if (tableRows.length > 0) {
          children.push(buildDocxTable(tableRows));
          continue;
        }
      }
      for (const fenceLine of fenceLines) {
        children.push(
          new Paragraph({
            children: parseInlineMarkdown(fenceLine),
          })
        );
      }
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = (heading[1]?.length ?? 1) - 1;
      const text = heading[2] ?? "";
      children.push(
        new Paragraph({
          children: parseInlineMarkdown(text),
          heading: HEADING_LEVELS[level] ?? HeadingLevel.HEADING_1,
        })
      );
      lineIndex += 1;
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineMarkdown(unordered[1] ?? ""),
        })
      );
      lineIndex += 1;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      children.push(
        new Paragraph({
          children: parseInlineMarkdown(ordered[1] ?? ""),
        })
      );
      lineIndex += 1;
      continue;
    }

    if (line.trim() === "") {
      children.push(new Paragraph({ children: [new TextRun("")] }));
      lineIndex += 1;
      continue;
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: parseInlineMarkdown(line),
      })
    );
    lineIndex += 1;
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const base64 = await Packer.toBase64String(doc);
  return `${DOCX_CONTENT_PREFIX}${base64}`;
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTextRuns(paragraphXml: string): string {
  const parts: string[] = [];
  const runPattern = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let runMatch = runPattern.exec(paragraphXml);

  while (runMatch) {
    const runXml = runMatch[1] ?? "";
    const isBold = /<w:b\b/.test(runXml) || /<w:bCs\b/.test(runXml);
    const isItalic = /<w:i\b/.test(runXml) || /<w:iCs\b/.test(runXml);
    const textParts: string[] = [];
    const textPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let textMatch = textPattern.exec(runXml);
    while (textMatch) {
      textParts.push(decodeXmlEntities(textMatch[1] ?? ""));
      textMatch = textPattern.exec(runXml);
    }
    let text = textParts.join("");
    if (text) {
      if (isBold) {
        text = `**${text}**`;
      } else if (isItalic) {
        text = `*${text}*`;
      }
      parts.push(text);
    }
    runMatch = runPattern.exec(paragraphXml);
  }

  return parts.join("");
}

function paragraphToMarkdown(paragraphXml: string): string {
  const text = extractTextRuns(paragraphXml);
  const style =
    paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";

  const heading = style.match(/^Heading(\d)$/i);
  if (heading) {
    const level = Math.min(6, Math.max(1, Number(heading[1])));
    return `${"#".repeat(level)} ${text}`.trim();
  }

  if (/ilvl="0"/.test(paragraphXml) || /numId=/.test(paragraphXml)) {
    return text ? `- ${text}` : "";
  }

  return text;
}

function tableXmlToMarkdown(tableXml: string): string {
  const rows: string[][] = [];
  const rowPattern = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch = rowPattern.exec(tableXml);

  while (rowMatch) {
    const rowXml = rowMatch[1] ?? "";
    const cells: string[] = [];
    const cellPattern = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let cellMatch = cellPattern.exec(rowXml);
    while (cellMatch) {
      const cellXml = cellMatch[1] ?? "";
      const cellParagraphs: string[] = [];
      const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let paragraphMatch = paragraphPattern.exec(cellXml);
      while (paragraphMatch) {
        const text = extractTextRuns(paragraphMatch[0]).trim();
        if (text) {
          cellParagraphs.push(text);
        }
        paragraphMatch = paragraphPattern.exec(cellXml);
      }
      cells.push(cellParagraphs.join(" ").trim());
      cellMatch = cellPattern.exec(rowXml);
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
    rowMatch = rowPattern.exec(tableXml);
  }

  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => {
    const next = [...row];
    while (next.length < columnCount) {
      next.push("");
    }
    return next;
  });
  const header = normalized[0] ?? Array.from({ length: columnCount }, () => "");
  const separator = Array.from({ length: columnCount }, () => "---");
  const body = normalized.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

/** Convert docx XML body into markdown (paragraphs + tables, in order). */
export function documentXmlToMarkdown(xml: string): string {
  const body = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const blocks: string[] = [];
  const blockPattern = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match = blockPattern.exec(body);

  while (match) {
    const block = match[0];
    if (block.startsWith("<w:tbl")) {
      const tableMarkdown = tableXmlToMarkdown(block);
      if (tableMarkdown) {
        blocks.push(tableMarkdown);
      }
    } else {
      // Skip paragraphs that live inside tables — already handled via w:tbl.
      const markdown = paragraphToMarkdown(block);
      if (markdown.trim()) {
        blocks.push(markdown);
      } else if (markdown === "") {
        blocks.push("");
      }
    }
    match = blockPattern.exec(body);
  }

  return blocks.join("\n").trim();
}

/** Convert HTML (tests / legacy helpers) into a markdown subset. */
export function htmlToMarkdown(html: string): string {
  const normalized = html
    .replace(/\r\n/g, "\n")
    .replace(/<\/(p|h[1-6]|li|ul|ol)>/gi, "</$1>\n")
    .replace(/<(ul|ol)[^>]*>/gi, "")
    .replace(/<\/(ul|ol)>/gi, "\n");

  const blocks = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const markdownLines: string[] = [];

  for (const block of blocks) {
    const heading = block.match(/^<h([1-6])[^>]*>([\s\S]*)<\/h\1>$/i);
    if (heading) {
      const level = Number(heading[1]);
      const text = heading[2]
        ?.replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<[^>]+>/g, "")
        .trim();
      markdownLines.push(`${"#".repeat(level)} ${text ?? ""}`.trim());
      continue;
    }

    const listItem = block.match(/^<li[^>]*>([\s\S]*)<\/li>$/i);
    if (listItem) {
      const text = listItem[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
      markdownLines.push(`- ${text}`);
      continue;
    }

    const paragraph = block.match(/^<p[^>]*>([\s\S]*)<\/p>$/i);
    if (paragraph) {
      const text = paragraph[1]
        ?.replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<[^>]+>/g, "")
        .trim();
      markdownLines.push(text ?? "");
      continue;
    }

    const text = block.replace(/<[^>]+>/g, "").trim();
    if (text) {
      markdownLines.push(text);
    }
  }

  return markdownLines.join("\n").trim();
}

/** Decode stored docx (or legacy markdown) for the editor / LLM. */
export async function decodeDocxContentToMarkdown(content: string) {
  if (!content.trim()) {
    return "";
  }

  if (!isDocxStoredContent(content)) {
    return repairMarkdownTables(content);
  }

  const base64 = content.slice(DOCX_CONTENT_PREFIX.length);
  const bytes = base64ToUint8Array(base64);
  const zip = await JSZip.loadAsync(bytes);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    return "";
  }
  const xml = await documentFile.async("string");
  return repairMarkdownTables(documentXmlToMarkdown(xml));
}

/**
 * Recover tables that were previously preserved as fenced code blocks.
 * Fully mashed cell text (no pipes) cannot be reconstructed — those need a rewrite.
 */
export function repairMarkdownTables(markdown: string): string {
  return markdown
    .replace(/```(?:\w*)\r?\n((?:\|.*\r?\n)+)\|?\s*```/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForMatch(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Replace the first matching passage in markdown.
 * Tries exact match, then whitespace-normalized match.
 * Returns null when the passage cannot be found.
 */
export function replaceFirstPassage(
  markdown: string,
  selectedText: string,
  replacement: string
): string | null {
  const selected = selectedText.trim();
  if (!selected) {
    return null;
  }

  const exactIndex = markdown.indexOf(selected);
  if (exactIndex >= 0) {
    return (
      markdown.slice(0, exactIndex) +
      replacement +
      markdown.slice(exactIndex + selected.length)
    );
  }

  const normalizedSelected = normalizeForMatch(selected);
  if (!normalizedSelected) {
    return null;
  }

  // Sliding window over markdown using whitespace-collapsed comparison.
  let markdownIndex = 0;
  while (markdownIndex < markdown.length) {
    while (
      markdownIndex < markdown.length &&
      /\s/.test(markdown.charAt(markdownIndex))
    ) {
      markdownIndex += 1;
    }
    if (markdownIndex >= markdown.length) {
      break;
    }

    let mi = markdownIndex;
    let si = 0;
    while (si < normalizedSelected.length && mi < markdown.length) {
      const selectedChar = normalizedSelected.charAt(si);
      const markdownChar = markdown.charAt(mi);
      if (/\s/.test(markdownChar)) {
        if (selectedChar !== " ") {
          break;
        }
        while (mi < markdown.length && /\s/.test(markdown.charAt(mi))) {
          mi += 1;
        }
        si += 1;
        continue;
      }
      if (markdownChar !== selectedChar) {
        break;
      }
      mi += 1;
      si += 1;
    }

    if (si === normalizedSelected.length) {
      return (
        markdown.slice(0, markdownIndex) + replacement + markdown.slice(mi)
      );
    }

    markdownIndex += 1;
  }

  return null;
}

/** Text form for LLM update prompts. */
export function textContentToPromptMarkdown(content: string) {
  return decodeDocxContentToMarkdown(content);
}

/** Download the working document as a real .docx file. */
export async function downloadTextAsDocx(title: string, content: string) {
  const filename = textDocumentFileName(title);
  let bytes: Uint8Array;

  if (isDocxStoredContent(content)) {
    bytes = base64ToUint8Array(content.slice(DOCX_CONTENT_PREFIX.length));
  } else {
    const stored = await encodeMarkdownAsDocxContent(content);
    bytes = base64ToUint8Array(stored.slice(DOCX_CONTENT_PREFIX.length));
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
