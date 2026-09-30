import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  evaluateXlsxBufferToSheets,
  formatSpreadsheetNumber,
  materializeXlsxFormulas,
} from "@/core/lib/artifacts/sheet-xlsx-exceljs";
import {
  decodeSheetContentToAoA,
  XLSX_CONTENT_PREFIX,
} from "@/shared/artifacts/sheet-xlsx";

async function buildBudgetXlsxWithoutCachedResults() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Budget");
  sheet.addRow([
    "Department",
    "Q1 Budget",
    "Q2 Budget",
    "Q3 Budget",
    "Q4 Budget",
  ]);
  sheet.addRow(["Engineering", 480_000, 500_000, 510_000, 520_000]);
  sheet.addRow(["Sales & Marketing", 360_000, 400_000, 410_000, 420_000]);
  sheet.addRow(["Operations", 220_000, 230_000, 235_000, 240_000]);
  sheet.addRow(["TOTAL BUDGET", null, null, null, null]);
  sheet.getCell("B5").value = { formula: "SUM(B2:B4)" };
  sheet.getCell("C5").value = { formula: "SUM(C2:C4)" };
  sheet.getCell("D5").value = { formula: "SUM(D2:D4)" };
  sheet.getCell("E5").value = { formula: "SUM(E2:E4)" };
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer;
}

describe("sheet-xlsx-exceljs", () => {
  it("evaluates TOTAL formulas that have no cached xlsx results", async () => {
    const buffer = await buildBudgetXlsxWithoutCachedResults();
    const [sheet] = await evaluateXlsxBufferToSheets(buffer);
    assert.equal(sheet?.rows.at(-1)?.[0], "TOTAL BUDGET");
    assert.equal(sheet?.rows.at(-1)?.[1], "$1,060,000");
    assert.equal(sheet?.rows.at(-1)?.[2], "$1,130,000");
    assert.equal(sheet?.rows.at(-1)?.[3], "$1,155,000");
    assert.equal(sheet?.rows.at(-1)?.[4], "$1,180,000");
  });

  it("materializes formula results into stored artifact content", async () => {
    const buffer = await buildBudgetXlsxWithoutCachedResults();
    const stored = `${XLSX_CONTENT_PREFIX}${buffer.toString("base64")}`;
    const materialized = await materializeXlsxFormulas(stored);
    const rows = decodeSheetContentToAoA(materialized);
    const total = rows.find((row) => row[0] === "TOTAL BUDGET");
    assert.deepEqual(total, [
      "TOTAL BUDGET",
      "$1,060,000",
      "$1,130,000",
      "$1,155,000",
      "$1,180,000",
    ]);
  });

  it("formats ratios as percents and respects excel numFmt", () => {
    assert.equal(formatSpreadsheetNumber(0.2756), "27.6%");
    assert.equal(formatSpreadsheetNumber(2_010_000), "$2,010,000");
    assert.equal(formatSpreadsheetNumber(0.276, "0.0%"), "27.6%");
  });

  it("preserves cell fill and font colors from xlsx", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Styled");
    sheet.getCell("A1").value = "Header";
    sheet.getCell("A1").fill = {
      fgColor: { argb: "FF4472C4" },
      pattern: "solid",
      type: "pattern",
    };
    sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("B1").value = -62_000;
    sheet.getCell("B1").font = { color: { argb: "FFFF0000" } };
    sheet.getCell("A2").value = "Plain";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const [result] = await evaluateXlsxBufferToSheets(buffer);
    assert.equal(result?.rows[0]?.[0], "Header");
    assert.deepEqual(result?.styles?.["0,0"], {
      background: "#4472C4",
      bold: true,
      color: "#FFFFFF",
    });
    assert.equal(result?.styles?.["0,1"]?.color, "#FF0000");
    assert.equal(result?.styles?.["1,0"], undefined);
  });

  it("keeps merged title text only in the anchor cell", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Budget");
    sheet.getCell("A1").value = "FY 2026 — Quarterly Budget";
    sheet.getCell("A1").fill = {
      fgColor: { argb: "FF1F4E79" },
      pattern: "solid",
      type: "pattern",
    };
    sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.mergeCells("A1:G1");
    sheet.getCell("A2").value = "Company-Wide CapEx";
    sheet.getCell("A2").fill = {
      fgColor: { argb: "FF2E75B6" },
      pattern: "solid",
      type: "pattern",
    };
    sheet.getCell("A2").font = { color: { argb: "FFFFFFFF" } };
    sheet.mergeCells("A2:G2");
    sheet.getCell("A3").value = "Department";
    sheet.getCell("B3").value = "Q1 Budget";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const [result] = await evaluateXlsxBufferToSheets(buffer);

    assert.equal(result?.rows[0]?.[0], "FY 2026 — Quarterly Budget");
    assert.deepEqual(result?.rows[0]?.slice(1, 7), ["", "", "", "", "", ""]);
    assert.equal(result?.rows[1]?.[0], "Company-Wide CapEx");
    assert.equal(result?.rows[1]?.[3], "");
    assert.equal(result?.styles?.["0,3"]?.background, "#1F4E79");
    assert.equal(result?.styles?.["1,5"]?.background, "#2E75B6");
    assert.equal(result?.rows[2]?.[0], "Department");
    assert.equal(result?.rows[2]?.[1], "Q1 Budget");
  });
});
