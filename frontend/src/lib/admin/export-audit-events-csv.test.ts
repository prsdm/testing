import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAuditEventsCsv } from "./export-audit-events-csv";

describe("buildAuditEventsCsv", () => {
  it("escapes commas and quotes in cells", () => {
    const csv = buildAuditEventsCsv([
      {
        action: "tenant.admin.roles.update",
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "admin@example.com",
        id: "evt-1",
        ipAddress: "127.0.0.1",
        metadata: { note: 'say "hello", team' },
        resource: "admin:acme:roles",
      },
    ]);

    assert.match(csv, /Updated role/);
    assert.match(csv, /admin@example.com/);
    assert.ok(csv.includes('""'));
  });
});
