import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferSandboxWorkSkillId,
  normalizeSandboxWorkSkillsEnabled,
} from "@/shared/sandbox/work-skill-catalog";

describe("work skill catalog", () => {
  it("infers skill id from sandbox code paths", () => {
    assert.equal(
      inferSandboxWorkSkillId(
        "python .kimiro/skills/slides/scripts/office/validate.py outputs/deck.pptx"
      ),
      "slides"
    );
    assert.equal(
      inferSandboxWorkSkillId(
        "python .kimiro/skills/docs/scripts/office/validate.py outputs/report.docx"
      ),
      "docs"
    );
    assert.equal(
      inferSandboxWorkSkillId(
        "python .kimiro/skills/pdf/scripts/convert_pdf_to_images.py outputs/file.pdf"
      ),
      "pdf"
    );
    assert.equal(
      inferSandboxWorkSkillId("cat .kimiro/skills/spreadsheets/SKILL.md"),
      "xlsx"
    );
    assert.equal(inferSandboxWorkSkillId("print('hello')"), null);
  });

  it("normalizes partial skill toggle payloads", () => {
    const enabled = normalizeSandboxWorkSkillsEnabled({ slides: false });
    assert.equal(enabled.slides, false);
    assert.equal(enabled.xlsx, true);
  });
});
