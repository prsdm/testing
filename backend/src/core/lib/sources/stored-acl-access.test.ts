import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessControlListsOverlap,
  filterKnowledgeItemsByStoredAcl,
  userCanAccessKnowledgeItem,
} from "./stored-acl-access";

describe("stored ACL access", () => {
  it("denies private non-connector items to non-owners", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["user:user-2"],
          createdByUserId: "user-2",
          externalRef: null,
          id: "item-1",
          sourceType: "manual",
          visibility: "private",
        },
        userAclTokens: ["user_email:alice@example.com", "tenant:tenant-1"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      false
    );
  });

  it("allows private non-connector items only for the owner", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["user:user-2"],
          createdByUserId: "user-2",
          externalRef: null,
          id: "item-1",
          sourceType: "upload",
          visibility: "private",
        },
        userAclTokens: ["user:user-2"],
        userEmail: "bob@example.com",
        userId: "user-2",
      }),
      true
    );
  });

  it("allows shared non-connector items when ACL tokens overlap", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["tenant:tenant-1", "user:user-2"],
          createdByUserId: "user-2",
          externalRef: null,
          id: "item-1",
          sourceType: "manual",
          visibility: "shared",
        },
        userAclTokens: ["tenant:tenant-1"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      true
    );
  });

  it("denies shared connector items with empty ACL and no direct access", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: [],
          createdByUserId: "user-2",
          externalRef: "file-1",
          id: "item-1",
          sourceType: "drive",
          visibility: "shared",
        },
        userAclTokens: ["user_email:alice@example.com", "tenant:tenant-1"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      false
    );
  });

  it("allows shared connector items when ACL tokens overlap", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["external_group:google_drive_marketing"],
          createdByUserId: "user-2",
          externalRef: "file-1",
          id: "item-1",
          sourceType: "drive",
          visibility: "shared",
        },
        userAclTokens: ["external_group:google_drive_marketing"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      true
    );
  });

  it("denies shared connector items without ACL overlap", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["external_group:google_drive_marketing"],
          createdByUserId: "user-2",
          externalRef: "file-1",
          id: "item-1",
          sourceType: "drive",
          visibility: "shared",
        },
        userAclTokens: ["external_group:google_drive_sales"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      false
    );
  });

  it("allows private connector items only for the owner", () => {
    const item = {
      accessControlList: ["user:user-1"],
      createdByUserId: "user-1",
      externalRef: "file-1",
      id: "item-1",
      sourceType: "drive" as const,
      visibility: "private" as const,
    };

    assert.equal(
      userCanAccessKnowledgeItem({
        item,
        userAclTokens: ["user:user-1"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }),
      true
    );
    assert.equal(
      userCanAccessKnowledgeItem({
        item,
        userAclTokens: ["user:user-2"],
        userEmail: "bob@example.com",
        userId: "user-2",
      }),
      false
    );
  });

  it("denies shared connector items with empty ACL even if sourceExternalAccess lists the email", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: [],
          createdByUserId: "user-1",
          externalRef: "page-1",
          id: "item-1",
          sourceExternalAccess: {
            groupIds: [],
            isTenantPublic: false,
            userEmails: ["alice@example.com"],
          },
          sourceType: "confluence",
          visibility: "shared",
        },
        userAclTokens: ["user_email:alice@example.com"],
        userEmail: "alice@example.com",
        userId: "user-2",
      }),
      false
    );
  });

  it("allows shared connector items when user_email is on the ACL", () => {
    assert.equal(
      userCanAccessKnowledgeItem({
        item: {
          accessControlList: ["user_email:alice@example.com"],
          createdByUserId: "user-1",
          externalRef: "page-1",
          id: "item-1",
          sourceType: "confluence",
          visibility: "shared",
        },
        userAclTokens: ["user_email:alice@example.com"],
        userEmail: "alice@example.com",
        userId: "user-2",
      }),
      true
    );
  });

  it("detects ACL overlap", () => {
    assert.equal(
      accessControlListsOverlap(
        ["user:user-1", "external_group:google_drive_team"],
        ["external_group:google_drive_team"]
      ),
      true
    );
    assert.equal(
      accessControlListsOverlap(["user:user-1"], ["external_group:other"]),
      false
    );
    assert.equal(accessControlListsOverlap(["user:user-1"], []), false);
  });

  it("filters lists with stored ACL rules", () => {
    const items = filterKnowledgeItemsByStoredAcl(
      [
        {
          accessControlList: ["user:user-2"],
          createdByUserId: "user-2",
          externalRef: null,
          id: "manual-private-other",
          sourceType: "manual",
          visibility: "private",
        },
        {
          accessControlList: ["user:user-1"],
          createdByUserId: "user-1",
          externalRef: null,
          id: "manual-owned",
          sourceType: "upload",
          visibility: "private",
        },
        {
          accessControlList: ["user_email:alice@example.com"],
          createdByUserId: "user-2",
          externalRef: "file-1",
          id: "drive-visible",
          sourceType: "drive",
          visibility: "shared",
        },
        {
          accessControlList: [],
          createdByUserId: "user-2",
          externalRef: "file-2",
          id: "drive-empty-acl",
          sourceType: "drive",
          visibility: "shared",
        },
        {
          accessControlList: ["user_email:bob@example.com"],
          createdByUserId: "user-2",
          externalRef: "file-3",
          id: "drive-hidden",
          sourceType: "drive",
          visibility: "shared",
        },
      ],
      {
        userAclTokens: ["user_email:alice@example.com", "user:user-1"],
        userEmail: "alice@example.com",
        userId: "user-1",
      }
    );

    assert.deepEqual(
      items.map((item) => item.id),
      ["manual-owned", "drive-visible"]
    );
  });
});
