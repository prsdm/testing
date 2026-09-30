import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUILTIN_WORK_SKILL_IDS,
  buildBuiltinWorkSkillFileSet,
  computeBuiltinWorkSkillsHash,
  renderSkillTemplate,
} from "@/core/lib/sandbox/sandbox-skills-files";

describe("sandbox skills files", () => {
  it("bundles work skills with rendered SKILL.md", () => {
    const files = buildBuiltinWorkSkillFileSet();

    for (const skillId of BUILTIN_WORK_SKILL_IDS) {
      const skillMd = files[`${skillId}/SKILL.md`];
      assert.ok(skillMd, `missing rendered SKILL.md for ${skillId}`);
      assert.doesNotMatch(
        skillMd.toString("utf8"),
        /\{\{ACTION_AVAILABILITY_SECTION\}\}/
      );
    }

    assert.ok(files["slides/SKILL.md"]);
    assert.ok(files["slides/scripts/thumbnail.py"]);
    assert.ok(files["slides/scripts/office/validate.py"]);
    assert.ok(!files["slides/charts.md"]);
    assert.ok(!files["presentation/SKILL.md"]);
    assert.ok(files["xlsx/SKILL.md"]);
    assert.ok(files["xlsx/scripts/recalc.py"]);
    assert.ok(files["spreadsheets/SKILL.md"]);
    assert.ok(files["spreadsheets/scripts/recalc.py"]);
    assert.ok(files["docs/SKILL.md"]);
    assert.ok(files["docs/scripts/office/validate.py"]);
    assert.ok(files["pdf/SKILL.md"]);
    assert.ok(files["pdf/scripts/convert_pdf_to_images.py"]);
  });

  it("produces a stable skills hash", () => {
    const files = buildBuiltinWorkSkillFileSet();
    const first = computeBuiltinWorkSkillsHash(files);
    const second = computeBuiltinWorkSkillsHash(files);

    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("strips action availability placeholders from templates", () => {
    const rendered = renderSkillTemplate(
      "Header\n\n{{ACTION_AVAILABILITY_SECTION}}\n\nBody"
    );

    assert.equal(rendered, "Header\n\nBody");
  });
});
