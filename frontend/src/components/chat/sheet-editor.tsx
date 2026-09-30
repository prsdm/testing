"use client";

import { useTheme } from "next-themes";
import { memo, useEffect, useMemo, useState } from "react";
import DataGrid, { textEditor } from "react-data-grid";
import {
  cellStyleKey,
  decodeWorkbook,
  encodeWorkbook,
  type SheetCellStyle,
  type WorkbookSheet,
} from "@/shared/artifacts/sheet-xlsx";
import { cn } from "@/shared/utils";

import "react-data-grid/lib/styles.css";

type SheetEditorProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  status: string;
  /** Default tab name when content is empty / legacy single CSV. */
  sheetName?: string;
  /** Compact preview (chat card) — still shows tabs when multi-sheet. */
  compact?: boolean;
  /** Disable grid edits (chat preview); tabs stay clickable. */
  readOnly?: boolean;
};

type GridRow = Record<string, string | number> & {
  id: number;
  rowNumber: number;
};

const MIN_ROWS = 50;
const MIN_COLS = 26;

function padGrid(rows: string[][]): string[][] {
  const paddedData = rows.map((row) => {
    const paddedRow = [...row];
    while (paddedRow.length < MIN_COLS) {
      paddedRow.push("");
    }
    return paddedRow;
  });
  while (paddedData.length < MIN_ROWS) {
    paddedData.push(new Array(MIN_COLS).fill(""));
  }
  return paddedData;
}

function gridToRows(
  gridRows: GridRow[],
  columns: Array<{ key: string }>
): string[][] {
  return gridRows.map((row) =>
    columns.slice(1).map((col) => String(row[col.key] ?? ""))
  );
}

function cellInlineStyle(style: SheetCellStyle | undefined) {
  if (!style) {
    return;
  }
  return {
    backgroundColor: style.background,
    color: style.color,
    fontWeight: style.bold ? 600 : undefined,
  } as const;
}

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  sheetName = "Sheet1",
  compact = false,
  readOnly = false,
}: SheetEditorProps) => {
  const { resolvedTheme } = useTheme();

  const workbookSheets = useMemo((): WorkbookSheet[] => {
    if (!content.trim()) {
      return [{ name: sheetName, rows: [[""]] }];
    }
    const decoded = decodeWorkbook(content);
    if (decoded.length === 1 && decoded[0]?.name === "Sheet1" && sheetName) {
      return [
        {
          name: sheetName,
          rows: decoded[0].rows,
          styles: decoded[0].styles,
        },
      ];
    }
    return decoded;
  }, [content, sheetName]);

  const [activeSheetName, setActiveSheetName] = useState(
    workbookSheets.at(0)?.name ?? sheetName
  );

  useEffect(() => {
    const names = new Set(workbookSheets.map((sheet) => sheet.name));
    if (!names.has(activeSheetName)) {
      setActiveSheetName(workbookSheets.at(0)?.name ?? sheetName);
    }
  }, [workbookSheets, activeSheetName, sheetName]);

  const activeSheet = useMemo(
    () =>
      workbookSheets.find((sheet) => sheet.name === activeSheetName) ??
      workbookSheets.at(0) ?? {
        name: sheetName,
        rows: [[""]],
      },
    [workbookSheets, activeSheetName, sheetName]
  );

  const parseData = useMemo(
    () => padGrid(activeSheet.rows),
    [activeSheet.rows]
  );

  const sheetStyles = activeSheet.styles ?? {};

  const columns = useMemo(() => {
    const rowNumberColumn = {
      cellClass: "border-t border-r dark:bg-neutral-950 dark:text-neutral-50",
      frozen: true,
      headerCellClass:
        "border-t border-r dark:bg-neutral-900 dark:text-neutral-50",
      key: "rowNumber",
      name: "",
      renderCell: ({ rowIdx }: { rowIdx: number }) => rowIdx + 1,
      width: 50,
    };

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      cellClass: (row: GridRow) => {
        const style = sheetStyles[cellStyleKey(row.id, i)];
        return cn("relative border-t", {
          "border-l": i !== 0,
          "dark:bg-neutral-950 dark:text-neutral-50": !style?.background,
        });
      },
      headerCellClass: cn("border-t dark:bg-neutral-900 dark:text-neutral-50", {
        "border-l": i !== 0,
      }),
      key: i.toString(),
      name: String.fromCharCode(65 + i),
      renderCell: ({ row, rowIdx }: { row: GridRow; rowIdx: number }) => {
        const style = sheetStyles[cellStyleKey(rowIdx, i)];
        const value = String(row[String(i)] ?? "");
        if (!style) {
          return value;
        }
        return (
          <div
            className="absolute inset-0 flex items-center overflow-hidden px-2"
            style={cellInlineStyle(style)}
          >
            {value}
          </div>
        );
      },
      renderEditCell: textEditor,
      width: 120,
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [sheetStyles]);

  const initialRows = useMemo(
    (): GridRow[] =>
      parseData.map((row, rowIndex) => {
        const rowData: GridRow = {
          id: rowIndex,
          rowNumber: rowIndex + 1,
        };

        for (let colIndex = 0; colIndex < MIN_COLS; colIndex++) {
          rowData[String(colIndex)] = row[colIndex] || "";
        }

        return rowData;
      }),
    [parseData]
  );

  const [localRows, setLocalRows] = useState(initialRows);

  useEffect(() => {
    setLocalRows(initialRows);
  }, [initialRows]);

  const persistSheets = (nextSheets: WorkbookSheet[]) => {
    saveContent(encodeWorkbook(nextSheets), true);
  };

  const handleRowsChange = (newRows: GridRow[]) => {
    if (readOnly) {
      return;
    }
    setLocalRows(newRows);
    const updatedData = gridToRows(newRows, columns);
    const nextSheets = workbookSheets.map((sheet) =>
      sheet.name === activeSheet.name
        ? { ...sheet, rows: updatedData, styles: sheet.styles }
        : sheet
    );
    persistSheets(nextSheets);
  };

  const showTabs = workbookSheets.length > 0;

  return (
    <div
      className="flex min-h-0 w-full flex-1 shrink-0 flex-col"
      data-sheet-editor
    >
      <div
        className={cn(
          "min-h-0 flex-1",
          compact ? "h-full" : undefined,
          readOnly && "pointer-events-none"
        )}
      >
        <DataGrid
          className={resolvedTheme === "dark" ? "rdg-dark" : "rdg-light"}
          columns={columns}
          defaultColumnOptions={{
            resizable: true,
            sortable: true,
          }}
          enableVirtualization
          onCellClick={(args) => {
            if (readOnly) {
              return;
            }
            if (args.column.key !== "rowNumber") {
              args.selectCell(true);
            }
          }}
          onRowsChange={handleRowsChange}
          rows={localRows}
          style={{ height: "100%", minHeight: 0, width: "100%" }}
        />
      </div>
      {showTabs ? (
        <div
          aria-label="Worksheets"
          className={cn(
            "flex shrink-0 items-end gap-1 overflow-x-auto border-border/50 border-t bg-muted/40 px-2 pt-1.5 pb-1.5",
            compact && "px-1.5 pt-1 pb-1"
          )}
          role="tablist"
        >
          {workbookSheets.map((sheet) => {
            const isActive = sheet.name === activeSheet.name;
            return (
              <div
                aria-selected={isActive}
                className={cn(
                  "shrink-0 cursor-pointer rounded-t-md border px-3 py-1 font-medium text-xs transition-colors",
                  isActive
                    ? "border-border/60 border-b-background bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
                key={sheet.name}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveSheetName(sheet.name);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveSheetName(sheet.name);
                  }
                }}
                role="tab"
                tabIndex={0}
              >
                {sheet.name}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

function areEqual(prevProps: SheetEditorProps, nextProps: SheetEditorProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.saveContent === nextProps.saveContent &&
    prevProps.sheetName === nextProps.sheetName &&
    prevProps.compact === nextProps.compact &&
    prevProps.readOnly === nextProps.readOnly
  );
}

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
