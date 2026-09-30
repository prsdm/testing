import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGreetingHeadline,
  getTimeOfDayGreeting,
} from "./greeting-message";

describe("greeting-message", () => {
  it("returns morning before noon", () => {
    assert.equal(
      getTimeOfDayGreeting(new Date("2026-01-01T09:00:00")),
      "Good morning"
    );
  });

  it("returns afternoon in the afternoon", () => {
    assert.equal(
      getTimeOfDayGreeting(new Date("2026-01-01T14:00:00")),
      "Good afternoon"
    );
  });

  it("returns evening at night", () => {
    assert.equal(
      getTimeOfDayGreeting(new Date("2026-01-01T20:00:00")),
      "Good evening"
    );
  });

  it("includes first name when provided", () => {
    assert.equal(
      buildGreetingHeadline("Admin"),
      `${getTimeOfDayGreeting()}, Admin!`
    );
  });

  it("uses generic headline without first name", () => {
    assert.equal(buildGreetingHeadline(), `${getTimeOfDayGreeting()}!`);
  });
});
