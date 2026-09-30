"use client";

import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
} from "prosemirror-markdown";
import { DOMParser, type Node } from "prosemirror-model";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { renderToString } from "react-dom/server";
import { MessageResponse } from "@/components/ai-elements/message";
import { repairMarkdownTables } from "@/shared/artifacts/text-docx";

import { documentSchema } from "./config";
import type { UISuggestion } from "./suggestions";

function escapeTableCell(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

function cellText(cell: Node): string {
  const parts: string[] = [];
  for (let i = 0; i < cell.childCount; i++) {
    parts.push(cell.child(i).textContent);
  }
  return escapeTableCell(parts.join(" "));
}

/** Serialize ProseMirror docs including GFM tables (for save / AI selection). */
export const documentMarkdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    table(state, node) {
      const rows: string[][] = [];
      for (let rowIndex = 0; rowIndex < node.childCount; rowIndex++) {
        const row = node.child(rowIndex);
        const cells: string[] = [];
        for (let cellIndex = 0; cellIndex < row.childCount; cellIndex++) {
          cells.push(cellText(row.child(cellIndex)));
        }
        rows.push(cells);
      }
      if (rows.length === 0) {
        return;
      }
      const columnCount = Math.max(...rows.map((row) => row.length), 1);
      const normalized = rows.map((row) => {
        const next = [...row];
        while (next.length < columnCount) {
          next.push("");
        }
        return next;
      });
      const header = normalized[0] ?? [];
      const separator = Array.from({ length: columnCount }, () => "---");
      const lines = [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
      ];
      for (const line of lines) {
        state.write(line);
        state.ensureNewLine();
      }
      state.closeBlock(node);
    },
    table_cell() {
      // Handled by `table`.
    },
    table_header() {
      // Handled by `table`.
    },
    table_row() {
      // Handled by `table`.
    },
  },
  defaultMarkdownSerializer.marks
);

/**
 * Normalize markdown-it / Streamdown table HTML so ProseMirror's table parseDOM
 * (which expects tbody/tr/td structure) can ingest header rows too.
 */
export function normalizeHtmlTables(root: HTMLElement) {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const thead = table.querySelector("thead");
    let tbody = table.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      table.append(tbody);
    }
    if (thead) {
      for (const row of Array.from(thead.querySelectorAll("tr")).reverse()) {
        tbody.prepend(row);
      }
      thead.remove();
    }
    for (const cell of Array.from(table.querySelectorAll("th, td"))) {
      if (!cell.querySelector("p") && cell.childNodes.length > 0) {
        const paragraph = document.createElement("p");
        while (cell.firstChild) {
          paragraph.append(cell.firstChild);
        }
        cell.append(paragraph);
      } else if (cell.childNodes.length === 0) {
        const paragraph = document.createElement("p");
        paragraph.append(document.createElement("br"));
        cell.append(paragraph);
      }
    }
  }
}

/**
 * Older saves wrapped tables in ``` fences so the editor wouldn't mash them.
 * Unwrap those so Streamdown/MessageResponse can render real HTML tables.
 */
export function unfenceMarkdownTables(markdown: string): string {
  return repairMarkdownTables(markdown);
}

export const buildDocumentFromContent = (content: string) => {
  const parser = DOMParser.fromSchema(documentSchema);
  const stringFromMarkdown = renderToString(
    <MessageResponse>{unfenceMarkdownTables(content)}</MessageResponse>
  );
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = stringFromMarkdown;
  normalizeHtmlTables(tempContainer);
  return parser.parse(tempContainer);
};

export const buildContentFromDocument = (document: Node) =>
  documentMarkdownSerializer.serialize(document);

export const createDecorations = (
  suggestions: UISuggestion[],
  _view: EditorView
) => {
  const decorations: Decoration[] = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
          "data-suggestion-id": suggestion.id,
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        }
      )
    );
  }

  return DecorationSet.create(_view.state.doc, decorations);
};
