import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateSeatCapacity,
  resolveBillableSeatCount,
} from "./seat-capacity";

describe("evaluateSeatCapacity", () => {
  it("blocks when not subscribed", () => {
    const result = evaluateSeatCapacity({
      activeSeats: 0,
      seatQuantity: 5,
      subscribed: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "not_subscribed");
    }
  });

  it("allows invite when paid seats remain", () => {
    const result = evaluateSeatCapacity({
      activeSeats: 2,
      pendingInvites: 0,
      reserveOne: true,
      seatQuantity: 3,
      subscribed: true,
    });
    assert.equal(result.ok, true);
  });

  it("blocks when active plus pending fill paid seats", () => {
    const result = evaluateSeatCapacity({
      activeSeats: 2,
      pendingInvites: 1,
      reserveOne: true,
      seatQuantity: 3,
      subscribed: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "at_capacity");
    }
  });

  it("blocks activate when at paid capacity", () => {
    const result = evaluateSeatCapacity({
      activeSeats: 2,
      reserveOne: true,
      seatQuantity: 2,
      subscribed: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "at_capacity");
    }
  });
});

describe("resolveBillableSeatCount", () => {
  it("uses paid seats when subscribed", () => {
    assert.equal(
      resolveBillableSeatCount({
        activeSeatCount: 2,
        paidSeatQuantity: 5,
        subscribed: true,
      }),
      5
    );
  });

  it("falls back to active seats when not subscribed", () => {
    assert.equal(
      resolveBillableSeatCount({
        activeSeatCount: 2,
        paidSeatQuantity: 5,
        subscribed: false,
      }),
      2
    );
  });
});
