import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseContentToNotionBlocks } from "./blocks";

describe("notion blocks", () => {
  it("parses headings, bullets, and todos", () => {
    const blocks = parseContentToNotionBlocks(
      "# Title\n## Section\n- item\n- [ ] todo\n- [x] done"
    );
    assert.equal(blocks.length, 5);
    assert.equal(blocks[0].type, "heading_1");
    assert.equal(blocks[1].type, "heading_2");
    assert.equal(blocks[2].type, "bulleted_list_item");
    assert.equal(blocks[3].type, "to_do");
    assert.equal((blocks[3].to_do as { checked?: boolean }).checked, false);
    assert.equal(blocks[4].type, "to_do");
    assert.equal((blocks[4].to_do as { checked?: boolean }).checked, true);
  });

  it("returns an empty paragraph when content is blank", () => {
    const blocks = parseContentToNotionBlocks("   ");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "paragraph");
  });
});
