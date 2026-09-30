import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { utils } from "xlsx";
import {
  applyMergedCellDisplay,
  decodeSheetContentToAoA,
  decodeWorkbook,
  encodeAoAAsXlsxContent,
  encodeCsvAsXlsxContent,
  encodeWorkbook,
  isXlsxStoredContent,
  parseSpreadsheetNumber,
  replaceSheetInWorkbook,
  sheetContentToPromptCsv,
  sheetFileName,
  sheetTabName,
  workbookToDisplaySheets,
  XLSX_CONTENT_PREFIX,
} from "./sheet-xlsx";

describe("sheet-xlsx", () => {
  it("uses .xlsx for display filenames", () => {
    assert.equal(sheetFileName("Budget"), "Budget.xlsx");
    assert.equal(sheetFileName("Budget.csv"), "Budget.xlsx");
    assert.equal(sheetFileName("Budget.xlsx"), "Budget.xlsx");
    assert.equal(sheetFileName(""), "Spreadsheet.xlsx");
  });

  it("sanitizes worksheet tab names", () => {
    assert.equal(sheetTabName("Budget Sample"), "Budget Sample");
    assert.equal(sheetTabName("A/B?C*D"), "ABCD");
    assert.equal(sheetTabName("x".repeat(40)).length, 31);
  });

  it("round-trips grid data as stored xlsx content", () => {
    const rows = [
      ["Category", "Amount"],
      ["Rent", "1500"],
      ["Food", "400"],
    ];
    const stored = encodeAoAAsXlsxContent(rows, "Budget");
    assert.ok(isXlsxStoredContent(stored));
    assert.ok(stored.startsWith(XLSX_CONTENT_PREFIX));

    const decoded = decodeSheetContentToAoA(stored);
    assert.deepEqual(decoded, rows);
    assert.match(sheetContentToPromptCsv(stored), /Category,Amount/);
  });

  it("still reads legacy CSV content", () => {
    const csv = "A,B\n1,2";
    assert.equal(isXlsxStoredContent(csv), false);
    assert.deepEqual(decodeSheetContentToAoA(csv), [
      ["A", "B"],
      ["1", "2"],
    ]);
  });

  it("encodes CSV drafts into xlsx storage", () => {
    const stored = encodeCsvAsXlsxContent("Name,Score\nAda,10", "Results");
    assert.ok(isXlsxStoredContent(stored));
    assert.deepEqual(decodeSheetContentToAoA(stored), [
      ["Name", "Score"],
      ["Ada", "10"],
    ]);
  });

  it("round-trips multi-sheet workbooks and preserves siblings on replace", () => {
    const stored = encodeWorkbook([
      {
        name: "Budget",
        rows: [
          ["Item", "Cost"],
          ["Rent", "1500"],
        ],
      },
      {
        name: "Notes",
        rows: [["Hello"], ["World"]],
      },
    ]);

    const sheets = decodeWorkbook(stored);
    assert.equal(sheets.length, 2);
    assert.equal(sheets[0]?.name, "Budget");
    assert.equal(sheets[1]?.name, "Notes");

    const updated = replaceSheetInWorkbook(stored, "Budget", [
      ["Item", "Cost"],
      ["Rent", "1600"],
    ]);
    const next = decodeWorkbook(updated);
    assert.equal(next.length, 2);
    assert.deepEqual(next[0]?.rows, [
      ["Item", "Cost"],
      ["Rent", "1600"],
    ]);
    assert.deepEqual(next[1]?.rows, [["Hello"], ["World"]]);
    assert.match(sheetContentToPromptCsv(updated), /[=]== Sheet: Budget ===/);
    assert.match(sheetContentToPromptCsv(updated), /[=]== Sheet: Notes ===/);
  });

  it("evaluates formula cells that have no cached value", () => {
    const sheet = utils.aoa_to_sheet([
      ["Dept", "Q1", "Q2", "Annual"],
      ["Engineering", 100, 200, null],
      ["Sales", 50, 75, null],
      ["TOTAL", null, null, null],
    ]);
    sheet.D2 = { f: "B2+C2", t: "n" };
    sheet.D3 = { f: "B3+C3", t: "n" };
    sheet.B4 = { f: "SUM(B2:B3)", t: "n" };
    sheet.C4 = { f: "SUM(C2:C3)", t: "n" };
    sheet.D4 = { f: "SUM(D2:D3)", t: "n" };
    sheet["!ref"] = "A1:D4";

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Budget");

    const [display] = workbookToDisplaySheets(workbook);
    assert.deepEqual(display?.rows, [
      ["Dept", "Q1", "Q2", "Annual"],
      ["Engineering", "100", "200", "300"],
      ["Sales", "50", "75", "125"],
      ["TOTAL", "150", "275", "425"],
    ]);
  });

  it("parses currency-like spreadsheet numbers for formula inputs", () => {
    assert.equal(parseSpreadsheetNumber("$480,000"), 480_000);
    assert.equal(parseSpreadsheetNumber("(1,200.50)"), -1200.5);
    assert.equal(parseSpreadsheetNumber("27.6%"), 0.276);
    assert.equal(parseSpreadsheetNumber("N/A"), null);
  });

  it("stores styled workbooks as sheetbook and round-trips styles", () => {
    const stored = encodeWorkbook([
      {
        name: "Budget",
        rows: [
          ["Q4", "($62,000)"],
          ["Total", "$5,460,000"],
        ],
        styles: {
          "0,0": { background: "#4472C4", bold: true, color: "#FFFFFF" },
          "0,1": { color: "#FF0000" },
        },
      },
    ]);
    assert.equal(isXlsxStoredContent(stored), false);
    assert.match(stored, /^sheetbook:1:/);
    const [sheet] = decodeWorkbook(stored);
    assert.equal(sheet?.name, "Budget");
    assert.deepEqual(sheet?.styles?.["0,0"], {
      background: "#4472C4",
      bold: true,
      color: "#FFFFFF",
    });
    assert.equal(sheet?.styles?.["0,1"]?.color, "#FF0000");
  });

  it("clears duplicate text in merged ranges and spreads banner styles", () => {
    const rows = [
      [
        "FY 2026 — Quarterly Budget",
        "FY 2026 — Quarterly Budget",
        "FY 2026 — Quarterly Budget",
      ],
      ["Department", "Q1", "Q2"],
    ];
    const styles: Record<
      string,
      { background?: string; color?: string; bold?: boolean }
    > = {
      "0,0": { background: "#1F4E79", bold: true, color: "#FFFFFF" },
    };
    applyMergedCellDisplay(rows, styles, [
      { endCol: 2, endRow: 0, startCol: 0, startRow: 0 },
    ]);
    assert.deepEqual(rows[0], ["FY 2026 — Quarterly Budget", "", ""]);
    assert.equal(styles["0,1"]?.background, "#1F4E79");
    assert.equal(styles["0,2"]?.color, "#FFFFFF");
  });
});
