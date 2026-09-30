import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMessageSectionTime,
  shouldShowMessageSectionTime,
} from "./message-section-time";

test("formatMessageSectionTime formats today", () => {
  const now = new Date("2026-07-10T12:00:00");
  const label = formatMessageSectionTime("2026-07-10T12:09:00", now);

  assert.match(label ?? "", /^Today /);
  assert.match(label ?? "", /12:09/);
});

test("formatMessageSectionTime formats another day", () => {
  const now = new Date("2026-07-10T12:00:00");
  const label = formatMessageSectionTime("2026-04-10T15:28:00", now);

  assert.match(label ?? "", /Apr 10/);
  assert.match(label ?? "", / at /);
  assert.match(label ?? "", /3:28/);
});

test("shouldShowMessageSectionTime shows for first message", () => {
  assert.equal(
    shouldShowMessageSectionTime("2026-07-10T12:00:00", undefined),
    true
  );
});

test("shouldShowMessageSectionTime shows across days", () => {
  assert.equal(
    shouldShowMessageSectionTime("2026-07-11T09:00:00", "2026-07-10T23:00:00"),
    true
  );
});

test("shouldShowMessageSectionTime shows after long gap", () => {
  assert.equal(
    shouldShowMessageSectionTime("2026-07-10T14:00:00", "2026-07-10T12:00:00"),
    true
  );
});

test("shouldShowMessageSectionTime hides for close messages same day", () => {
  assert.equal(
    shouldShowMessageSectionTime("2026-07-10T12:05:00", "2026-07-10T12:00:00"),
    false
  );
});
