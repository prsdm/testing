import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNotionUserId,
  type NotionWorkspaceUser,
  pickNotionUserMatch,
} from "./resolve-notion-user";

const USERS: NotionWorkspaceUser[] = [
  { email: "prsdm@example.com", id: "user-1", name: "Prsdm Dev" },
  { email: "alex@example.com", id: "user-2", name: "Alex Kim" },
];

describe("resolve notion user", () => {
  it("matches by partial name", () => {
    assert.deepEqual(pickNotionUserMatch(USERS, "prsdm"), USERS[0]);
  });

  it("matches by email", () => {
    assert.deepEqual(pickNotionUserMatch(USERS, "alex@example.com"), USERS[1]);
  });

  it("detects notion user ids", () => {
    assert.equal(isNotionUserId("6ee911d9-189c-4844-93e8-260c1438b6e4"), true);
    assert.equal(isNotionUserId("prsdm"), false);
  });
});
