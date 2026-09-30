import type { SecurityAuditEventRow } from "@/contracts/admin";
import { formatAuditActionLabel } from "@/lib/admin/audit-action-labels";

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAuditEventsCsv(events: SecurityAuditEventRow[]) {
  const header = [
    "Time (UTC)",
    "Action",
    "Label",
    "Email",
    "Resource",
    "IP address",
    "Metadata",
  ];
  const rows = events.map((event) => [
    event.createdAt,
    event.action,
    formatAuditActionLabel(event.action),
    event.email ?? "",
    event.resource ?? "",
    event.ipAddress ?? "",
    event.metadata ? JSON.stringify(event.metadata) : "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

export function downloadAuditEventsCsv(
  events: SecurityAuditEventRow[],
  filename: string
) {
  const csv = buildAuditEventsCsv(events);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
