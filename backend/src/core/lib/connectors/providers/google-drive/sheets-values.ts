import {
  applyMergedCellDisplay,
  cssFromRgbChannels,
  mergeSheetCellStyle,
  type SheetCellStyle,
  type SheetMergeRange,
  sheetTabName,
  trimDisplayRowsWithStyles,
  type WorkbookSheet,
} from "@/shared/artifacts/sheet-xlsx";

type SheetsPropertiesResponse = {
  sheets?: Array<{
    properties?: {
      title?: string;
      index?: number;
      sheetId?: number;
      gridProperties?: {
        rowCount?: number;
        columnCount?: number;
      };
    };
  }>;
};

type SheetsBatchGetResponse = {
  valueRanges?: Array<{
    range?: string;
    values?: unknown[][];
  }>;
};

type SheetsColor = {
  red?: number;
  green?: number;
  blue?: number;
  alpha?: number;
};

type GridCell = {
  formattedValue?: string;
  effectiveValue?: {
    numberValue?: number;
    stringValue?: string;
    boolValue?: boolean;
  };
  userEnteredValue?: {
    formulaValue?: string;
  };
  effectiveFormat?: {
    backgroundColor?: SheetsColor;
    textFormat?: {
      foregroundColor?: SheetsColor;
      bold?: boolean;
    };
  };
};

type GridDataSheet = {
  properties?: {
    title?: string;
  };
  merges?: Array<{
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  }>;
  data?: Array<{
    rowData?: Array<{
      values?: GridCell[];
    }>;
  }>;
};

type SheetsGridResponse = {
  sheets?: GridDataSheet[];
};

function quoteSheetRange(title: string) {
  const escaped = title.replaceAll("'", "''");
  return `'${escaped}'`;
}

function columnLetter(index: number) {
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label || "A";
}

function normalizeSheetRows(values: unknown[][] | undefined): string[][] {
  if (!values || values.length === 0) {
    return [[""]];
  }
  const width = values.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    0
  );
  const rows = values.map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const out: string[] = [];
    for (let index = 0; index < width; index += 1) {
      const cell = cells[index];
      out.push(cell == null ? "" : String(cell));
    }
    return out;
  });
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  return nonEmpty.length > 0 ? nonEmpty : [[""]];
}

function cellFromGridValue(cell: GridCell | undefined) {
  if (!cell) {
    return "";
  }
  if (cell.formattedValue != null && cell.formattedValue !== "") {
    return cell.formattedValue;
  }
  const effective = cell.effectiveValue;
  if (!effective) {
    return "";
  }
  if (typeof effective.numberValue === "number") {
    return String(effective.numberValue);
  }
  if (typeof effective.boolValue === "boolean") {
    return effective.boolValue ? "TRUE" : "FALSE";
  }
  if (typeof effective.stringValue === "string") {
    return effective.stringValue;
  }
  return "";
}

function styleFromGridCell(cell: GridCell | undefined): SheetCellStyle | null {
  const format = cell?.effectiveFormat;
  if (!format) {
    return null;
  }
  const style: SheetCellStyle = {};
  if (format.backgroundColor) {
    style.background = cssFromRgbChannels(format.backgroundColor);
  }
  if (format.textFormat?.foregroundColor) {
    style.color = cssFromRgbChannels(format.textFormat.foregroundColor);
  }
  if (format.textFormat?.bold) {
    style.bold = true;
  }
  if (!style.background && !style.color && !style.bold) {
    return null;
  }
  return style;
}

function sheetMergesFromGrid(sheet: GridDataSheet): SheetMergeRange[] {
  const ranges: SheetMergeRange[] = [];
  for (const merge of sheet.merges ?? []) {
    const startRow = merge.startRowIndex;
    const endRowExclusive = merge.endRowIndex;
    const startCol = merge.startColumnIndex;
    const endColExclusive = merge.endColumnIndex;
    if (
      typeof startRow !== "number" ||
      typeof endRowExclusive !== "number" ||
      typeof startCol !== "number" ||
      typeof endColExclusive !== "number" ||
      endRowExclusive <= startRow ||
      endColExclusive <= startCol
    ) {
      continue;
    }
    ranges.push({
      endCol: endColExclusive - 1,
      endRow: endRowExclusive - 1,
      startCol,
      startRow,
    });
  }
  return ranges;
}

function gridSheetToWorkbookSheet(sheet: GridDataSheet): WorkbookSheet {
  const rowData = sheet.data?.[0]?.rowData ?? [];
  if (rowData.length === 0) {
    return {
      name: sheetTabName(sheet.properties?.title?.trim() || "Sheet1"),
      rows: [[""]],
    };
  }
  const width = rowData.reduce(
    (max, row) => Math.max(max, row.values?.length ?? 0),
    0
  );
  const rows: string[][] = [];
  const styles: Record<string, SheetCellStyle> = {};

  for (let rowIndex = 0; rowIndex < rowData.length; rowIndex += 1) {
    const values = rowData[rowIndex]?.values ?? [];
    const out: string[] = [];
    for (let colIndex = 0; colIndex < width; colIndex += 1) {
      const cell = values[colIndex];
      out.push(cellFromGridValue(cell));
      const cellStyle = styleFromGridCell(cell);
      if (cellStyle) {
        mergeSheetCellStyle(styles, rowIndex, colIndex, cellStyle);
      }
    }
    rows.push(out);
  }

  applyMergedCellDisplay(rows, styles, sheetMergesFromGrid(sheet));
  const trimmed = trimDisplayRowsWithStyles(rows, styles);
  return {
    name: sheetTabName(sheet.properties?.title?.trim() || "Sheet1"),
    rows: trimmed.rows,
    styles: Object.keys(trimmed.styles).length > 0 ? trimmed.styles : undefined,
  };
}

async function fetchSheetTitles(input: {
  spreadsheetId: string;
  accessToken: string;
}) {
  const metaResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}?fields=sheets.properties`,
    {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    }
  );
  if (!metaResponse.ok) {
    const body = await metaResponse.text().catch(() => "");
    throw new Error(
      `Google Sheets metadata failed (${metaResponse.status}): ${body.slice(0, 300)}`
    );
  }

  const meta = (await metaResponse.json()) as SheetsPropertiesResponse;
  return (meta.sheets ?? [])
    .map((sheet) => ({
      columnCount: Math.min(
        sheet.properties?.gridProperties?.columnCount ?? 52,
        100
      ),
      rowCount: Math.min(
        sheet.properties?.gridProperties?.rowCount ?? 2000,
        5000
      ),
      title: sheet.properties?.title?.trim() ?? "",
    }))
    .filter((sheet) => sheet.title.length > 0);
}

async function fetchViaValuesBatchGet(input: {
  spreadsheetId: string;
  accessToken: string;
  sheets: Array<{ title: string; rowCount: number; columnCount: number }>;
}): Promise<WorkbookSheet[]> {
  const params = new URLSearchParams({
    dateTimeRenderOption: "FORMATTED_STRING",
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });
  for (const sheet of input.sheets) {
    const endCol = columnLetter(Math.max(sheet.columnCount - 1, 0));
    const endRow = Math.max(sheet.rowCount, 1);
    // Explicit range so calculated cells inside the grid are not dropped.
    params.append(
      "ranges",
      `${quoteSheetRange(sheet.title)}!A1:${endCol}${endRow}`
    );
  }

  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}/values:batchGet?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    }
  );
  if (!valuesResponse.ok) {
    const body = await valuesResponse.text().catch(() => "");
    throw new Error(
      `Google Sheets values failed (${valuesResponse.status}): ${body.slice(0, 300)}`
    );
  }

  const payload = (await valuesResponse.json()) as SheetsBatchGetResponse;
  const valueRanges = payload.valueRanges ?? [];

  return input.sheets.map((sheet, index) => ({
    name: sheetTabName(sheet.title),
    rows: normalizeSheetRows(valueRanges[index]?.values),
  }));
}

async function fetchViaGridData(input: {
  spreadsheetId: string;
  accessToken: string;
}): Promise<WorkbookSheet[]> {
  const fields = [
    "sheets(properties(title),merges",
    "data(rowData(values(formattedValue,effectiveValue,effectiveFormat(backgroundColor,textFormat(foregroundColor,bold))))))",
  ].join(",");
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.spreadsheetId)}?includeGridData=true&fields=${encodeURIComponent(fields)}`,
    {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Google Sheets grid failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
  const payload = (await response.json()) as SheetsGridResponse;
  const sheets = payload.sheets ?? [];
  if (sheets.length === 0) {
    return [{ name: "Sheet1", rows: [[""]] }];
  }
  return sheets.map((sheet) => gridSheetToWorkbookSheet(sheet));
}

/**
 * Load a Google Sheet as calculated display values via the Sheets API.
 * Prefers grid data so cell fills / font colors are preserved.
 */
export async function fetchGoogleSheetAsWorkbookSheets(input: {
  spreadsheetId: string;
  accessToken: string;
}): Promise<WorkbookSheet[]> {
  try {
    return await fetchViaGridData(input);
  } catch {
    const sheets = await fetchSheetTitles(input);
    if (sheets.length === 0) {
      return [{ name: "Sheet1", rows: [[""]] }];
    }
    return await fetchViaValuesBatchGet({
      accessToken: input.accessToken,
      sheets,
      spreadsheetId: input.spreadsheetId,
    });
  }
}
