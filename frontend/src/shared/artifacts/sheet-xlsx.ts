import { HyperFormula } from "hyperformula";
import Papa from "papaparse";
import type { CellObject, WorkBook, WorkSheet } from "xlsx";
// biome-ignore lint/performance/noNamespaceImport: supports both Node CJS and Vite ESM xlsx entrypoints
import * as XLSXNamespace from "xlsx";

const XLSX = (
  "read" in XLSXNamespace
    ? XLSXNamespace
    : Reflect.get(XLSXNamespace, "default")
) as typeof import("xlsx");
const { read, SSF, utils, write, writeFile } = XLSX;
const { parse, unparse } = Papa;

/** Stored sheet documents use this prefix + base64 workbook bytes. */
export const XLSX_CONTENT_PREFIX = "xlsx:base64:";

/** Styled multi-sheet workbook (values + cell colors/bold). */
export const SHEETBOOK_PREFIX = "sheetbook:1:";

export type SheetCellStyle = {
  background?: string;
  color?: string;
  bold?: boolean;
};

export type WorkbookSheet = {
  name: string;
  rows: string[][];
  /** Cell styles keyed by `"row,col"` (0-based). */
  styles?: Record<string, SheetCellStyle>;
};

export function cellStyleKey(row: number, col: number) {
  return `${row},${col}`;
}

export function workbookHasStyles(sheets: WorkbookSheet[]) {
  return sheets.some(
    (sheet) => sheet.styles && Object.keys(sheet.styles).length > 0
  );
}

export function isSheetbookStoredContent(content: string) {
  return content.startsWith(SHEETBOOK_PREFIX);
}

/** Convert #RRGGBB (or similar) into a usable CSS hex color. */
export function normalizeCssHex(
  hex: string | undefined | null
): string | undefined {
  if (!hex) {
    return undefined;
  }
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    return `#${cleaned.slice(2).toUpperCase()}`;
  }
  return undefined;
}

function hexChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Skip default white fills / black text so the grid theme still works. */
export function isDefaultSpreadsheetColor(
  hex: string,
  kind: "background" | "color"
) {
  const normalized = normalizeCssHex(hex);
  if (!normalized) {
    return true;
  }
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if (kind === "background") {
    return r >= 245 && g >= 245 && b >= 245;
  }
  return r <= 40 && g <= 40 && b <= 40;
}

export function cssFromRgbChannels(input: {
  red?: number;
  green?: number;
  blue?: number;
}): string | undefined {
  const r = Math.round((input.red ?? 0) * 255);
  const g = Math.round((input.green ?? 0) * 255);
  const b = Math.round((input.blue ?? 0) * 255);
  return `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`;
}

export function mergeSheetCellStyle(
  target: Record<string, SheetCellStyle>,
  row: number,
  col: number,
  style: SheetCellStyle
) {
  const key = cellStyleKey(row, col);
  const existing = target[key] ?? {};
  const next: SheetCellStyle = { ...existing };
  if (
    style.background &&
    !isDefaultSpreadsheetColor(style.background, "background")
  ) {
    next.background = normalizeCssHex(style.background);
  }
  if (style.color && !isDefaultSpreadsheetColor(style.color, "color")) {
    next.color = normalizeCssHex(style.color);
  }
  if (style.bold) {
    next.bold = true;
  }
  if (!next.background && !next.color && !next.bold) {
    return;
  }
  target[key] = next;
}

/**
 * Remap styles after removing empty rows (same filter as display trim).
 */
export function trimDisplayRowsWithStyles(
  rows: string[][],
  styles: Record<string, SheetCellStyle> = {}
): { rows: string[][]; styles: Record<string, SheetCellStyle> } {
  const kept: number[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.some((cell) => cell.trim() !== "")) {
      kept.push(index);
    }
  }
  if (kept.length === 0) {
    return { rows: [[""]], styles: {} };
  }
  const nextRows = kept.map((index) => rows[index] ?? [""]);
  const remap = new Map(kept.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const nextStyles: Record<string, SheetCellStyle> = {};
  for (const [key, style] of Object.entries(styles)) {
    const [rowText, colText] = key.split(",");
    const row = Number(rowText);
    const col = Number(colText);
    const newRow = remap.get(row);
    if (newRow === undefined || !Number.isFinite(col)) {
      continue;
    }
    nextStyles[cellStyleKey(newRow, col)] = style;
  }
  return { rows: nextRows, styles: nextStyles };
}

/** Inclusive 0-based merge rectangle (Excel / Sheets title banners, etc.). */
export type SheetMergeRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

/**
 * Keep merged-title text only in the top-left cell; clear the rest and
 * copy the master style so banner fills span the full merge.
 */
export function applyMergedCellDisplay(
  rows: string[][],
  styles: Record<string, SheetCellStyle>,
  merges: SheetMergeRange[]
) {
  for (const merge of merges) {
    if (
      merge.endRow < merge.startRow ||
      merge.endCol < merge.startCol ||
      (merge.startRow === merge.endRow && merge.startCol === merge.endCol)
    ) {
      continue;
    }
    const masterStyle = styles[cellStyleKey(merge.startRow, merge.startCol)];
    for (let row = merge.startRow; row <= merge.endRow; row += 1) {
      const line = rows[row];
      if (!line) {
        continue;
      }
      for (let col = merge.startCol; col <= merge.endCol; col += 1) {
        if (row === merge.startRow && col === merge.startCol) {
          continue;
        }
        if (col < line.length) {
          line[col] = "";
        }
        if (masterStyle) {
          mergeSheetCellStyle(styles, row, col, masterStyle);
        }
      }
    }
  }
}

/** User-facing spreadsheet filename (always .xlsx). */
export function sheetFileName(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    return "Spreadsheet.xlsx";
  }
  if (/\.xlsx$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\.(csv|xls|tsv)$/i.test(trimmed)) {
    return `${trimmed.replace(/\.(csv|xls|tsv)$/i, "")}.xlsx`;
  }
  return `${trimmed}.xlsx`;
}

/** Excel worksheet tab name (max 31 chars, no invalid chars). */
export function sheetTabName(title: string) {
  const cleaned = title
    .trim()
    .replace(/[\\/?*[\]:]/g, "")
    .replace(/\.xlsx$/i, "")
    .replace(/\.(csv|xls|tsv)$/i, "");
  const base = cleaned || "Sheet1";
  return base.slice(0, 31);
}

export function isXlsxStoredContent(content: string) {
  return content.startsWith(XLSX_CONTENT_PREFIX);
}

export function csvToAoA(csv: string): string[][] {
  if (!csv.trim()) {
    return [[""]];
  }
  const parsed = parse<string[]>(csv, { skipEmptyLines: true });
  const rows = parsed.data.map((row) => row.map((cell) => String(cell ?? "")));
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  return nonEmpty.length > 0 ? nonEmpty : [[""]];
}

export function aoAToCsv(rows: string[][]): string {
  const nonEmpty = rows.filter((row) =>
    row.some((cell) => String(cell ?? "").trim() !== "")
  );
  return unparse(nonEmpty.length > 0 ? nonEmpty : [[""]]);
}

function trimAoA(rows: string[][]): string[][] {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  return nonEmpty.length > 0 ? nonEmpty : [[""]];
}

/** Parse currency / percent / plain numbers from spreadsheet display text. */
export function parseSpreadsheetNumber(raw: string): number | null {
  let text = raw.trim();
  if (!text) {
    return null;
  }
  const parenNegative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, "").trim();
  const isPercent = text.endsWith("%");
  if (isPercent) {
    text = text.slice(0, -1).trim();
  }
  text = text.replace(/[$€£¥₹₽₩,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  let value = Number(text);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (parenNegative) {
    value = -value;
  }
  if (isPercent) {
    value /= 100;
  }
  return value;
}

function sheetHasFormula(sheet: WorkSheet) {
  for (const key of Object.keys(sheet)) {
    if (key.startsWith("!")) {
      continue;
    }
    const cell = sheet[key] as CellObject | undefined;
    if (cell?.f) {
      return true;
    }
  }
  return false;
}

function cellFallbackText(cell: CellObject | undefined) {
  if (!cell) {
    return "";
  }
  if (cell.w != null && String(cell.w).length > 0) {
    return String(cell.w);
  }
  if (cell.v == null) {
    return "";
  }
  return String(cell.v);
}

function cellToHfValue(
  cell: CellObject | undefined
): string | number | boolean | null {
  if (!cell) {
    return null;
  }
  if (cell.f) {
    return `=${cell.f}`;
  }
  if (typeof cell.v === "number" || typeof cell.v === "boolean") {
    return cell.v;
  }
  if (typeof cell.v === "string") {
    const parsed = parseSpreadsheetNumber(cell.v);
    if (parsed != null) {
      return parsed;
    }
    return cell.v;
  }
  if (cell.v != null) {
    return String(cell.v);
  }
  if (cell.w) {
    const parsed = parseSpreadsheetNumber(String(cell.w));
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function sheetToHfMatrix(
  sheet: WorkSheet
): (string | number | boolean | null)[][] {
  const ref = sheet["!ref"];
  if (!ref) {
    return [[null]];
  }
  const range = utils.decode_range(ref);
  const rows: (string | number | boolean | null)[][] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: (string | number | boolean | null)[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = utils.encode_cell({ c: colIndex, r: rowIndex });
      row.push(cellToHfValue(sheet[address] as CellObject | undefined));
    }
    rows.push(row);
  }
  return rows;
}

function formatEvaluatedValue(value: unknown, cell: CellObject | undefined) {
  if (value !== null && typeof value === "object" && "type" in value) {
    return cellFallbackText(cell);
  }
  if (typeof value === "number") {
    if (cell?.z) {
      try {
        return SSF.format(cell.z, value);
      } catch {
        // fall through
      }
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value == null) {
    return cellFallbackText(cell);
  }
  return String(value);
}

function worksheetToAoASimple(sheet: WorkSheet): string[][] {
  const rows = utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    {
      defval: "",
      header: 1,
      raw: false,
    }
  );
  const normalized = rows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? ""))
  );
  return trimAoA(normalized);
}

function worksheetToAoAFromHf(
  sheet: WorkSheet,
  hf: HyperFormula,
  sheetId: number
): string[][] {
  const ref = sheet["!ref"];
  if (!ref) {
    return [[""]];
  }
  const range = utils.decode_range(ref);
  const rows: string[][] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: string[] = [];
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const address = utils.encode_cell({ c: colIndex, r: rowIndex });
      const cell = sheet[address] as CellObject | undefined;
      const localRow = rowIndex - range.s.r;
      const localCol = colIndex - range.s.c;
      try {
        const value = hf.getCellValue({
          col: localCol,
          row: localRow,
          sheet: sheetId,
        });
        row.push(formatEvaluatedValue(value, cell));
      } catch {
        row.push(cellFallbackText(cell));
      }
    }
    rows.push(row);
  }
  return trimAoA(rows);
}

/** Evaluate formulas (when present) into a display grid. */
export function workbookToDisplaySheets(workbook: WorkBook): WorkbookSheet[] {
  if (workbook.SheetNames.length === 0) {
    return [{ name: "Sheet1", rows: [[""]] }];
  }

  const anyFormula = workbook.SheetNames.some((name) =>
    sheetHasFormula(workbook.Sheets[name] ?? {})
  );

  if (!anyFormula) {
    return workbook.SheetNames.map((name) => ({
      name,
      rows: worksheetToAoASimple(workbook.Sheets[name] ?? {}),
    }));
  }

  const sheetsData: Record<string, (string | number | boolean | null)[][]> = {};
  for (const name of workbook.SheetNames) {
    sheetsData[name] = sheetToHfMatrix(workbook.Sheets[name] ?? {});
  }

  try {
    const hf = HyperFormula.buildFromSheets(sheetsData, {
      licenseKey: "gpl-v3",
      useColumnIndex: false,
    });

    return workbook.SheetNames.map((name) => {
      const sheetId = hf.getSheetId(name);
      if (sheetId === undefined) {
        return {
          name,
          rows: worksheetToAoASimple(workbook.Sheets[name] ?? {}),
        };
      }
      return {
        name,
        rows: worksheetToAoAFromHf(workbook.Sheets[name] ?? {}, hf, sheetId),
      };
    });
  } catch {
    return workbook.SheetNames.map((name) => ({
      name,
      rows: worksheetToAoASimple(workbook.Sheets[name] ?? {}),
    }));
  }
}

function uniqueSheetNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const base = sheetTabName(raw);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    if (count === 0) {
      return base;
    }
    const suffix = ` (${count + 1})`;
    return `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
  });
}

/** Decode stored xlsx / sheetbook (or legacy CSV) into all worksheets. */
export function decodeWorkbook(content: string): WorkbookSheet[] {
  if (!content.trim()) {
    return [{ name: "Sheet1", rows: [[""]] }];
  }

  if (isSheetbookStoredContent(content)) {
    try {
      const parsed = JSON.parse(
        content.slice(SHEETBOOK_PREFIX.length)
      ) as WorkbookSheet[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [{ name: "Sheet1", rows: [[""]] }];
      }
      return parsed.map((sheet) => ({
        name: sheetTabName(sheet.name || "Sheet1"),
        rows:
          Array.isArray(sheet.rows) && sheet.rows.length > 0
            ? sheet.rows.map((row) =>
                (Array.isArray(row) ? row : []).map((cell) =>
                  String(cell ?? "")
                )
              )
            : [[""]],
        styles: sheet.styles,
      }));
    } catch {
      return [{ name: "Sheet1", rows: [[""]] }];
    }
  }

  if (isXlsxStoredContent(content)) {
    const base64 = content.slice(XLSX_CONTENT_PREFIX.length);
    const workbook = read(base64, {
      cellFormula: true,
      cellNF: true,
      cellText: true,
      type: "base64",
    });
    return workbookToDisplaySheets(workbook);
  }

  return [{ name: "Sheet1", rows: csvToAoA(content) }];
}

/**
 * SheetJS cannot reliably read formulas without cached results.
 * Drive imports must use `materializeXlsxFormulas` from sheet-xlsx-exceljs.
 */
export function materializeXlsxFormulasWithSheetJs(content: string): string {
  if (!isXlsxStoredContent(content)) {
    return content;
  }
  return encodeWorkbook(decodeWorkbook(content));
}

/** Persist a multi-sheet workbook (xlsx, or sheetbook when styles exist). */
export function encodeWorkbook(sheets: WorkbookSheet[]): string {
  const normalized =
    sheets.length > 0
      ? sheets
      : [{ name: "Sheet1", rows: [[""]] as string[][] }];
  const names = uniqueSheetNames(normalized.map((sheet) => sheet.name));
  const named = normalized.map((sheet, index) => ({
    ...sheet,
    name: names[index] ?? sheet.name,
  }));

  if (workbookHasStyles(named)) {
    return `${SHEETBOOK_PREFIX}${JSON.stringify(
      named.map((sheet) => ({
        name: sheet.name,
        rows: sheet.rows.length > 0 ? sheet.rows : [[""]],
        styles: sheet.styles,
      }))
    )}`;
  }

  const workbook = utils.book_new();
  for (const [index, sheet] of named.entries()) {
    const rows = sheet.rows.length > 0 ? sheet.rows : [[""]];
    const worksheet = utils.aoa_to_sheet(rows);
    utils.book_append_sheet(workbook, worksheet, names[index] ?? "Sheet1");
  }

  const base64 = write(workbook, {
    bookType: "xlsx",
    type: "base64",
  }) as string;
  return `${XLSX_CONTENT_PREFIX}${base64}`;
}

/** Persistable single-sheet workbook (create / simple replace). */
export function encodeAoAAsXlsxContent(
  rows: string[][],
  tabName = "Sheet1"
): string {
  return encodeWorkbook([{ name: tabName, rows }]);
}

export function encodeCsvAsXlsxContent(
  csv: string,
  tabName = "Sheet1"
): string {
  return encodeAoAAsXlsxContent(csvToAoA(csv), tabName);
}

/**
 * Replace one worksheet in an existing workbook (preserves other sheets).
 * Used when the model returns a single CSV for an update.
 */
export function replaceSheetInWorkbook(
  content: string,
  sheetName: string,
  rows: string[][]
): string {
  const sheets = decodeWorkbook(content);
  const target = sheetTabName(sheetName);
  const index = sheets.findIndex(
    (sheet) => sheetTabName(sheet.name) === target
  );
  if (index >= 0) {
    const next = [...sheets];
    next[index] = { name: sheets[index]?.name ?? target, rows };
    return encodeWorkbook(next);
  }
  if (sheets.length === 1 && sheets[0]) {
    return encodeWorkbook([{ name: sheets[0].name, rows }]);
  }
  return encodeWorkbook([...sheets, { name: target, rows }]);
}

/** First sheet grid — backwards-compatible helper. */
export function decodeSheetContentToAoA(content: string): string[][] {
  return decodeWorkbook(content).at(0)?.rows ?? [[""]];
}

/** Text form for LLM update prompts (all sheets labeled). */
export function sheetContentToPromptCsv(content: string): string {
  const sheets = decodeWorkbook(content);
  if (sheets.length === 1) {
    return aoAToCsv(sheets[0]?.rows ?? [[""]]);
  }
  return sheets
    .map((sheet) => `=== Sheet: ${sheet.name} ===\n${aoAToCsv(sheet.rows)}`)
    .join("\n\n");
}

/** Download the working workbook as a real .xlsx file. */
export function downloadSheetAsXlsx(title: string, content: string) {
  const filename = sheetFileName(title);

  if (isXlsxStoredContent(content)) {
    const base64 = content.slice(XLSX_CONTENT_PREFIX.length);
    const workbook = read(base64, { type: "base64" });
    writeFile(workbook, filename);
    return;
  }

  const sheets = decodeWorkbook(content);
  const workbook = utils.book_new();
  for (const sheet of sheets) {
    utils.book_append_sheet(
      workbook,
      utils.aoa_to_sheet(sheet.rows.length > 0 ? sheet.rows : [[""]]),
      sheetTabName(sheet.name)
    );
  }
  writeFile(workbook, filename);
}
