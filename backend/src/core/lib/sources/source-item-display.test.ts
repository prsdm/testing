import assert from "node:assert/strict";
import test from "node:test";
import {
  expandAllowedKbItemIdsForSearch,
  normalizeAgentAllowedSourceItemIds,
} from "@/core/lib/sources/source-agent-scope";
import {
  filterSelectableKbItems,
  formatKbItemDisplayTitle,
} from "@/core/lib/sources/source-item-display";

test("formatKbItemDisplayTitle formats notion databases with row counts", () => {
  const database = {
    externalRef: "notion-database:abc123",
    sourceType: "notion" as const,
    title: "Bug Tracker (database)",
  };
  const rows = [
    {
      externalRef: "page-1",
      sourceType: "notion" as const,
      title: "Bug Tracker / Glitch in Animation",
    },
    {
      externalRef: "page-2",
      sourceType: "notion" as const,
      title: "Bug Tracker / chat UI bug",
    },
  ];

  assert.equal(
    formatKbItemDisplayTitle(database, [database, ...rows]),
    "Bug Tracker · 2 rows"
  );
});

test("formatKbItemDisplayTitle keeps regular notion page titles", () => {
  const page = {
    externalRef: "page-1",
    sourceType: "notion" as const,
    title: "Getting Started",
  };

  assert.equal(formatKbItemDisplayTitle(page, [page]), "Getting Started");
});

test("filterSelectableKbItems hides notion row items when database parent is indexed", () => {
  const database = {
    externalRef: "notion-database:abc123",
    id: "db-1",
    sourceType: "notion" as const,
    title: "Bug Tracker (database)",
  };
  const rows = [
    {
      externalRef: "page-1",
      id: "row-1",
      sourceType: "notion" as const,
      title: "Bug Tracker / Glitch in Animation",
    },
    {
      externalRef: "page-2",
      id: "row-2",
      sourceType: "notion" as const,
      title: "Bug Tracker / chat UI bug",
    },
    {
      externalRef: "page-3",
      id: "page-1",
      sourceType: "notion" as const,
      title: "Getting Started",
    },
  ];

  const selectable = filterSelectableKbItems([database, ...rows]);
  assert.deepEqual(
    selectable.map((item) => item.id),
    ["db-1", "page-1"]
  );
});

test("normalizeAgentAllowedSourceItemIds collapses legacy notion row ids to database parent", () => {
  const normalized = normalizeAgentAllowedSourceItemIds(
    ["row-1", "row-2"],
    new Set(["db-1"]),
    { "row-1": "db-1", "row-2": "db-1" }
  );

  assert.deepEqual(normalized, ["db-1"]);
});

test("expandAllowedKbItemIdsForSearch includes indexed row ids for database parent", () => {
  const database = {
    externalRef: "notion-database:abc123",
    id: "db-1",
    sourceType: "notion" as const,
    title: "Bug Tracker (database)",
  };
  const rows = [
    {
      externalRef: "page-1",
      id: "row-1",
      sourceType: "notion" as const,
      title: "Bug Tracker / Glitch in Animation",
    },
    {
      externalRef: "page-2",
      id: "row-2",
      sourceType: "notion" as const,
      title: "Bug Tracker / chat UI bug",
    },
  ];

  const expanded = expandAllowedKbItemIdsForSearch(
    ["db-1"],
    [database, ...rows]
  );

  assert.deepEqual(expanded.sort(), ["db-1", "row-1", "row-2"].sort());
});
