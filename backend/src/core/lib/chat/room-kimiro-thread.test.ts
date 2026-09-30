import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRoomKimiroThreadScope } from "./room-kimiro-thread";

describe("resolveRoomKimiroThreadScope", () => {
  const root = "00000000-0000-4000-8000-0000000000aa";
  const user = "00000000-0000-4000-8000-0000000000bb";

  it("scopes main @Kimiro to a thread rooted at the user message", () => {
    assert.deepEqual(
      resolveRoomKimiroThreadScope({
        clientThreadRootMessageId: null,
        invokesKimiro: true,
        userMessageId: user,
      }),
      {
        assistantThreadRootMessageId: user,
        historyThreadRootMessageId: user,
        userThreadRootMessageId: null,
      }
    );
  });

  it("keeps explicit thread replies on the client thread root", () => {
    assert.deepEqual(
      resolveRoomKimiroThreadScope({
        clientThreadRootMessageId: root,
        invokesKimiro: true,
        userMessageId: user,
      }),
      {
        assistantThreadRootMessageId: root,
        historyThreadRootMessageId: root,
        userThreadRootMessageId: root,
      }
    );
  });
});
