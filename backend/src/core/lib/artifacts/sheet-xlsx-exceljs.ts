import ExcelJS from "exceljs";
import { HyperFormula } from "hyperformula";
// biome-ignore lint/performance/noNamespaceImport: supports Node's CommonJS xlsx entrypoint
import * as XLSXNamespace from "xlsx";
import {
  applyMergedCellDisplay,
  encodeWorkbook,
  isXlsxStoredContent,
  mergeSheetCellStyle,
  normalizeCssHex,
  parseSpreadsheetNumber,
  type SheetCellStyle,
  type SheetMergeRange,
  sheetTabName,
  trimDisplayRowsWithStyles,
  type WorkbookSheet,
  XLSX_CONTENT_PREFIX,
} from "@/shared/artifacts/sheet-xlsx";

const XLSX = (
  "read" in XLSXNamespace
    ? XLSXNamespace
    : Reflect.get(XLSXNamespace, "default")
) as typeof import("xlsx");
const { SSF } = XLSX;

type HfCell = string | number | boolean | null;

/** Format a calculated number like Excel (%, $, thousands separators). */
export function formatSpreadsheetNumber(
  value: number,
  numFmt?: string | null
): string {
  const fmt = numFmt?.trim();
  if (fmt && fmt !== "General") {
    try {
      return SSF.format(fmt, value);
    } catch {
      // fall through to heuristics
    }
  }

  if (fmt?.includes("%")) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (
    fmt &&
    (fmt.includes("$") ||
      fmt.toLowerCase().includes("usd") ||
      /#,##0/.test(fmt))
  ) {
    const useCurrency = fmt.includes("$") || fmt.toLowerCase().includes("usd");
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: 0,
      style: useCurrency ? "currency" : "decimal",
    }).format(value);
  }

  // Common budget sheets: proportions look like raw 0.2756 — show as percent
  if (value > 0 && value <= 1 && !Number.isInteger(value)) {
    return `${(value * 100).toFixed(1)}%`;
  }

  if (Number.isInteger(value) && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(value);
  }

  return String(value);
}

function excelCellToHfValue(cell: ExcelJS.Cell): HfCell {
  const formula =
    cell.formula ||
    (cell.value &&
    typeof cell.value === "object" &&
    "formula" in cell.value &&
    typeof (cell.value as { formula?: string }).formula === "string"
      ? (cell.value as { formula: string }).formula
      : null);

  if (formula) {
    return `=${formula}`;
  }

  const value = cell.value;
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "richText" in value) {
    const text = (value.richText as Array<{ text: string }>)
      .map((part) => part.text)
      .join("");
    return parseSpreadsheetNumber(text) ?? text;
  }
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result?: unknown }).result;
    if (typeof result === "number" || typeof result === "boolean") {
      return result;
    }
    if (typeof result === "string") {
      return parseSpreadsheetNumber(result) ?? result;
    }
  }
  if (typeof value === "string") {
    return parseSpreadsheetNumber(value) ?? value;
  }
  return String(value);
}

function excelCellFallbackText(cell: ExcelJS.Cell): string {
  const text = cell.text;
  if (typeof text === "string" && text.length > 0) {
    return text;
  }
  const value = cell.value;
  if (typeof value === "number") {
    return formatSpreadsheetNumber(value, cell.numFmt);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result?: unknown }).result;
    if (typeof result === "number") {
      return formatSpreadsheetNumber(result, cell.numFmt);
    }
    if (result != null) {
      return String(result);
    }
  }
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as Array<{ text: string }>)
      .map((part) => part.text)
      .join("");
  }
  if (typeof value === "string") {
    return value;
  }
  return cell.text || "";
}

function formatHfDisplay(
  value: unknown,
  fallback: string,
  numFmt?: string | null
): string {
  if (typeof value === "number") {
    return formatSpreadsheetNumber(value, numFmt);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value == null) {
    return fallback;
  }
  return String(value);
}

/** Office theme accents commonly used when xlsx stores theme+tint instead of ARGB. */
const OFFICE_THEME_RGB = [
  "FFFFFF",
  "000000",
  "E7E6E6",
  "44546A",
  "4472C4",
  "ED7D31",
  "A5A5A5",
  "FFC000",
  "5B9BD5",
  "70AD47",
  "0563C1",
  "954F72",
] as const;

function applyExcelTint(hex6: string, tint: number | undefined): string {
  if (tint == null || tint === 0) {
    return hex6;
  }
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(hex6.slice(offset, offset + 2), 16)
  );
  const next = channels.map((channel) => {
    if (tint < 0) {
      return channel * (1 + tint);
    }
    return channel * (1 - tint) + 255 * tint;
  });
  return next
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    )
    .join("");
}

function excelColorToCss(
  color: Partial<ExcelJS.Color> | undefined
): string | undefined {
  if (!color) {
    return undefined;
  }
  if (color.argb) {
    return normalizeCssHex(color.argb);
  }
  if (typeof color.theme === "number") {
    const base =
      OFFICE_THEME_RGB[color.theme] ??
      OFFICE_THEME_RGB[color.theme % OFFICE_THEME_RGB.length];
    if (!base) {
      return undefined;
    }
    const tintValue = (color as { tint?: number }).tint;
    return normalizeCssHex(applyExcelTint(base, tintValue));
  }
  return undefined;
}

export function excelCellToSheetStyle(
  cell: ExcelJS.Cell,
  displayNumber?: number | null
): SheetCellStyle | null {
  const style: SheetCellStyle = {};
  const fill = cell.fill;
  if (fill && fill.type === "pattern" && fill.pattern !== "none") {
    const background =
      excelColorToCss(fill.fgColor) ?? excelColorToCss(fill.bgColor);
    if (background) {
      style.background = background;
    }
  }
  const font = cell.font;
  if (font) {
    const color = excelColorToCss(font.color);
    if (color) {
      style.color = color;
    }
    if (font.bold) {
      style.bold = true;
    }
  }

  // Excel number formats often color negatives via [Red] in the format string
  // rather than a static font color (common for budget deltas).
  if (
    !style.color &&
    typeof displayNumber === "number" &&
    displayNumber < 0 &&
    typeof cell.numFmt === "string" &&
    /\[red\]/i.test(cell.numFmt)
  ) {
    style.color = "#FF0000";
  }

  if (!style.background && !style.color && !style.bold) {
    return null;
  }
  return style;
}

function worksheetMergeRanges(worksheet: ExcelJS.Worksheet): SheetMergeRange[] {
  const merges = (
    worksheet as ExcelJS.Worksheet & {
      _merges?: Record<
        string,
        {
          model?: {
            top?: number;
            left?: number;
            bottom?: number;
            right?: number;
          };
        }
      >;
    }
  )._merges;
  if (!merges) {
    return [];
  }
  const ranges: SheetMergeRange[] = [];
  for (const range of Object.values(merges)) {
    const model = range?.model;
    if (
      !model ||
      typeof model.top !== "number" ||
      typeof model.left !== "number" ||
      typeof model.bottom !== "number" ||
      typeof model.right !== "number"
    ) {
      continue;
    }
    ranges.push({
      endCol: model.right - 1,
      endRow: model.bottom - 1,
      startCol: model.left - 1,
      startRow: model.top - 1,
    });
  }
  return ranges;
}

function isExcelMergeSlave(cell: ExcelJS.Cell) {
  return (
    cell.isMerged && cell.master != null && cell.master.address !== cell.address
  );
}

function worksheetToHfMatrix(worksheet: ExcelJS.Worksheet): {
  matrix: HfCell[][];
  fallbacks: string[][];
  numFmts: Array<Array<string | null>>;
  styles: Record<string, SheetCellStyle>;
  merges: SheetMergeRange[];
} {
  const rowCount = Math.max(worksheet.rowCount, 1);
  const colCount = Math.max(worksheet.columnCount, 1);
  const matrix: HfCell[][] = [];
  const fallbacks: string[][] = [];
  const numFmts: Array<Array<string | null>> = [];
  const styles: Record<string, SheetCellStyle> = {};
  const merges = worksheetMergeRanges(worksheet);

  for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
    const row: HfCell[] = [];
    const fallbackRow: string[] = [];
    const fmtRow: Array<string | null> = [];
    for (let colIndex = 1; colIndex <= colCount; colIndex += 1) {
      const cell = worksheet.getCell(rowIndex, colIndex);
      const mergeSlave = isExcelMergeSlave(cell);
      const styleCell = mergeSlave ? cell.master : cell;

      if (mergeSlave) {
        row.push(null);
        fallbackRow.push("");
        fmtRow.push(null);
      } else {
        const hfValue = excelCellToHfValue(cell);
        row.push(hfValue);
        fallbackRow.push(excelCellFallbackText(cell));
        fmtRow.push(typeof cell.numFmt === "string" ? cell.numFmt : null);
      }

      const numericHint = mergeSlave
        ? null
        : typeof row.at(-1) === "number"
          ? (row.at(-1) as number)
          : typeof cell.value === "number"
            ? cell.value
            : null;
      const cellStyle = excelCellToSheetStyle(styleCell, numericHint);
      if (cellStyle) {
        mergeSheetCellStyle(styles, rowIndex - 1, colIndex - 1, cellStyle);
      }
    }
    matrix.push(row);
    fallbacks.push(fallbackRow);
    numFmts.push(fmtRow);
  }

  return { fallbacks, matrix, merges, numFmts, styles };
}

function matrixToDisplaySheet(
  name: string,
  matrix: HfCell[][],
  fallbacks: string[][],
  numFmts: Array<Array<string | null>>,
  styles: Record<string, SheetCellStyle>,
  merges: SheetMergeRange[] = []
): WorkbookSheet {
  const rows = matrix.map((row, rowIndex) =>
    row.map((cell, colIndex) => {
      if (typeof cell === "number") {
        return formatSpreadsheetNumber(cell, numFmts[rowIndex]?.[colIndex]);
      }
      if (typeof cell === "boolean") {
        return String(cell);
      }
      if (typeof cell === "string" && !cell.startsWith("=")) {
        return cell;
      }
      return fallbacks[rowIndex]?.[colIndex] ?? "";
    })
  );
  applyMergedCellDisplay(rows, styles, merges);
  const trimmed = trimDisplayRowsWithStyles(rows, styles);
  return {
    name,
    rows: trimmed.rows,
    styles: Object.keys(trimmed.styles).length > 0 ? trimmed.styles : undefined,
  };
}

/**
 * Load xlsx bytes with ExcelJS (preserves formulas SheetJS drops),
 * evaluate with HyperFormula, return display grids (+ cell styles).
 */
export async function evaluateXlsxBufferToSheets(
  buffer: Buffer
): Promise<WorkbookSheet[]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS Buffer typings disagree with current @types/node Buffer generics.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]
  );

  const worksheets = workbook.worksheets.filter(
    (sheet) => sheet.state !== "hidden" && sheet.state !== "veryHidden"
  );
  if (worksheets.length === 0) {
    return [{ name: "Sheet1", rows: [[""]] }];
  }

  const sheetsData: Record<string, HfCell[][]> = {};
  const fallbackByName = new Map<string, string[][]>();
  const numFmtByName = new Map<string, Array<Array<string | null>>>();
  const stylesByName = new Map<string, Record<string, SheetCellStyle>>();
  const mergesByName = new Map<string, SheetMergeRange[]>();
  const order: string[] = [];

  for (const worksheet of worksheets) {
    let name = sheetTabName(worksheet.name || "Sheet1");
    if (name in sheetsData) {
      name = sheetTabName(`${name} ${order.length + 1}`);
    }
    const { matrix, fallbacks, numFmts, styles, merges } =
      worksheetToHfMatrix(worksheet);
    sheetsData[name] = matrix;
    fallbackByName.set(name, fallbacks);
    numFmtByName.set(name, numFmts);
    stylesByName.set(name, styles);
    mergesByName.set(name, merges);
    order.push(name);
  }

  const hasFormula = Object.values(sheetsData).some((matrix) =>
    matrix.some((row) =>
      row.some((cell) => typeof cell === "string" && cell.startsWith("="))
    )
  );

  if (!hasFormula) {
    return order.map((name) =>
      matrixToDisplaySheet(
        name,
        sheetsData[name] ?? [[null]],
        fallbackByName.get(name) ?? [[""]],
        numFmtByName.get(name) ?? [[]],
        stylesByName.get(name) ?? {},
        mergesByName.get(name) ?? []
      )
    );
  }

  try {
    const hf = HyperFormula.buildFromSheets(sheetsData, {
      licenseKey: "gpl-v3",
      useColumnIndex: false,
    });

    return order.map((name) => {
      const sheetId = hf.getSheetId(name);
      const matrix = sheetsData[name] ?? [[null]];
      const fallbacks = fallbackByName.get(name) ?? [[""]];
      const numFmts = numFmtByName.get(name) ?? [[]];
      const styles = stylesByName.get(name) ?? {};
      const merges = mergesByName.get(name) ?? [];
      if (sheetId === undefined) {
        return matrixToDisplaySheet(
          name,
          matrix,
          fallbacks,
          numFmts,
          styles,
          merges
        );
      }

      const rows: string[][] = [];
      const evaluatedStyles: Record<string, SheetCellStyle> = { ...styles };
      for (let r = 0; r < matrix.length; r += 1) {
        const row: string[] = [];
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
          const fallback = fallbacks[r]?.[c] ?? "";
          const numFmt = numFmts[r]?.[c];
          try {
            const value = hf.getCellValue({ col: c, row: r, sheet: sheetId });
            row.push(formatHfDisplay(value, fallback, numFmt));
            if (
              typeof value === "number" &&
              value < 0 &&
              typeof numFmt === "string" &&
              /\[red\]/i.test(numFmt)
            ) {
              mergeSheetCellStyle(evaluatedStyles, r, c, { color: "#FF0000" });
            }
          } catch {
            row.push(fallback);
          }
        }
        rows.push(row);
      }
      applyMergedCellDisplay(rows, evaluatedStyles, merges);
      const trimmed = trimDisplayRowsWithStyles(rows, evaluatedStyles);
      return {
        name,
        rows: trimmed.rows,
        styles:
          Object.keys(trimmed.styles).length > 0 ? trimmed.styles : undefined,
      };
    });
  } catch {
    return order.map((name) =>
      matrixToDisplaySheet(
        name,
        sheetsData[name] ?? [[null]],
        fallbackByName.get(name) ?? [[""]],
        numFmtByName.get(name) ?? [[]],
        stylesByName.get(name) ?? {},
        mergesByName.get(name) ?? []
      )
    );
  }
}

/** Bake formula results into stored xlsx artifact content (async, server-only). */
export async function materializeXlsxFormulas(
  content: string
): Promise<string> {
  if (!isXlsxStoredContent(content)) {
    return content;
  }
  const base64 = content.slice(XLSX_CONTENT_PREFIX.length);
  const buffer = Buffer.from(base64, "base64");
  const sheets = await evaluateXlsxBufferToSheets(buffer);
  return encodeWorkbook(sheets);
}
