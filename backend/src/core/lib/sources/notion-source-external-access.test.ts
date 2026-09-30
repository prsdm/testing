import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveNotionSourceExternalAccess } from "@/core/lib/sources/notion-source-external-access";

describe("resolveNotionSourceExternalAccess", () => {
  it("defaults to indexer-only on first index", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-alice",
      indexerEmail: "alice@company.com",
    });
    assert.deepEqual(access, {
      groupIds: [],
      isTenantPublic: false,
      userEmails: ["alice@company.com"],
    });
  });

  it("merges indexers in indexers mode", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-bob",
      existingAccess: {
        groupIds: [],
        isTenantPublic: false,
        userEmails: ["alice@company.com"],
      },
      indexerEmail: "bob@company.com",
      ownerUserId: "user-alice",
      shareMode: "indexers",
    });
    assert.deepEqual(access?.userEmails.sort(), [
      "alice@company.com",
      "bob@company.com",
    ]);
    assert.equal(access?.isTenantPublic, false);
  });

  it("shares with selected teammates", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-alice",
      indexerEmail: "alice@company.com",
      ownerUserId: "user-alice",
      shareMode: "selected",
      shareWithEmails: ["bob@company.com"],
    });
    assert.deepEqual(access?.userEmails.sort(), [
      "alice@company.com",
      "bob@company.com",
    ]);
    assert.equal(access?.isTenantPublic, false);
  });

  it("lets owner replace selected list", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-alice",
      existingAccess: {
        groupIds: [],
        isTenantPublic: false,
        userEmails: ["alice@company.com", "bob@company.com"],
      },
      indexerEmail: "alice@company.com",
      ownerUserId: "user-alice",
      shareMode: "selected",
      shareWithEmails: ["carol@company.com"],
    });
    assert.deepEqual(access?.userEmails.sort(), [
      "alice@company.com",
      "carol@company.com",
    ]);
  });

  it("publishes to the workspace for admins", () => {
    const access = resolveNotionSourceExternalAccess({
      actorIsAdmin: true,
      actorUserId: "user-alice",
      indexerEmail: "alice@company.com",
      shareMode: "workspace",
    });
    assert.equal(access?.isTenantPublic, true);
    assert.deepEqual(access?.userEmails, ["alice@company.com"]);
  });

  it("blocks non-admins from publishing to workspace", () => {
    const access = resolveNotionSourceExternalAccess({
      actorIsAdmin: false,
      actorUserId: "user-bob",
      indexerEmail: "bob@company.com",
      shareMode: "workspace",
    });
    assert.equal(access, null);
  });

  it("keeps published access when a non-owner tries to downgrade", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-bob",
      existingAccess: {
        groupIds: [],
        isTenantPublic: true,
        userEmails: ["alice@company.com"],
      },
      indexerEmail: "bob@company.com",
      ownerUserId: "user-alice",
      shareMode: "indexers",
    });
    assert.equal(access?.isTenantPublic, true);
  });

  it("lets the owner unpublish back to indexer list", () => {
    const access = resolveNotionSourceExternalAccess({
      actorUserId: "user-alice",
      existingAccess: {
        groupIds: [],
        isTenantPublic: true,
        userEmails: ["alice@company.com", "bob@company.com"],
      },
      indexerEmail: "alice@company.com",
      ownerUserId: "user-alice",
      shareMode: "indexers",
    });
    assert.equal(access?.isTenantPublic, false);
    assert.deepEqual(access?.userEmails.sort(), [
      "alice@company.com",
      "bob@company.com",
    ]);
  });
});
