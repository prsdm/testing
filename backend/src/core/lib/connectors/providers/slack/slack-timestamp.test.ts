import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeSlackMessageTs,
  normalizeSlackTimestamp,
  startOfUtcDayTimestamp,
} from "./slack-timestamp";

describe("normalizeSlackTimestamp", () => {
  it("accepts slack-style unix timestamps", () => {
    assert.equal(
      normalizeSlackTimestamp("1512085950.000216"),
      "1512085950.000216"
    );
  });

  it("converts millisecond timestamps to seconds", () => {
    assert.equal(normalizeSlackTimestamp("1512085950000"), "1512085950");
  });

  it("converts YYYY-MM-DD dates to utc midnight", () => {
    assert.equal(
      normalizeSlackTimestamp("2026-06-20"),
      `${Date.parse("2026-06-20T00:00:00.000Z") / 1000}.000000`
    );
  });
});

describe("normalizeSlackMessageTs", () => {
  it("converts compact permalink timestamps", () => {
    assert.equal(
      normalizeSlackMessageTs("1512085950000216"),
      "1512085950.000216"
    );
  });

  it("keeps dotted slack timestamps", () => {
    assert.equal(
      normalizeSlackMessageTs("1512085950.000216"),
      "1512085950.000216"
    );
  });
});

describe("startOfUtcDayTimestamp", () => {
  it("returns utc midnight for the given date", () => {
    assert.equal(
      startOfUtcDayTimestamp(new Date("2026-06-20T15:30:00.000Z")),
      `${Date.parse("2026-06-20T00:00:00.000Z") / 1000}.000000`
    );
  });
});
