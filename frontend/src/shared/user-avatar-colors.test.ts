import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getUserAvatarFallbackColor,
  userAvatarColorSeed,
} from "./user-avatar-colors";

describe("user avatar fallback colors", () => {
  it("is stable for the same seed", () => {
    const a = getUserAvatarFallbackColor("ada@example.com");
    const b = getUserAvatarFallbackColor("ada@example.com");
    assert.equal(a, b);
  });

  it("prefers user id over email for seed", () => {
    assert.equal(
      userAvatarColorSeed({
        email: "a@b.com",
        name: "Other",
        userId: "user-1",
      }),
      "id:user-1"
    );
  });
});
