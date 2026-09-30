import assert from "node:assert/strict";
import test from "node:test";
import {
  isPostgresDeadlock,
  retryOnPostgresDeadlock,
} from "@/core/lib/db/retry-on-deadlock";

function postgresDeadlockError() {
  return Object.assign(new Error("deadlock detected"), { code: "40P01" });
}

test("isPostgresDeadlock detects Postgres deadlock code", () => {
  assert.equal(isPostgresDeadlock({ code: "40P01" }), true);
  assert.equal(isPostgresDeadlock({ code: "23505" }), false);
  assert.equal(isPostgresDeadlock(new Error("deadlock")), false);
});

test("retryOnPostgresDeadlock retries deadlock errors", async () => {
  let attempts = 0;
  const result = await retryOnPostgresDeadlock(() => {
    attempts += 1;
    if (attempts < 2) {
      throw postgresDeadlockError();
    }
    return "ok";
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("retryOnPostgresDeadlock does not retry non-deadlock errors", async () => {
  let attempts = 0;
  await assert.rejects(
    retryOnPostgresDeadlock(() => {
      attempts += 1;
      throw new Error("boom");
    }),
    /boom/
  );
  assert.equal(attempts, 1);
});
